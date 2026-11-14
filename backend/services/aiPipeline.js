// Web-service side of the AI pipeline: queue AI card runs on Render Workflows
// and read their status back. When RENDER_API_KEY / AI_WORKFLOW_SLUG are not set
// (e.g. local dev), the pipeline is "off" and the API generates cards inline.
const Mentee = require('../models/Mentee');
const WorkflowRun = require('../models/WorkflowRun');

const TERMINAL = new Set(['succeeded', 'completed', 'failed', 'canceled']);
const STALE_JOB_MS = 10 * 60 * 1000; // a run stuck this long is ignored and re-queued

let client = null;
function render() {
  if (!client) {
    const { Render } = require('@renderinc/sdk');
    client = new Render(); // reads RENDER_API_KEY
  }
  return client;
}

const enabled = () => Boolean(process.env.RENDER_API_KEY && process.env.AI_WORKFLOW_SLUG);
const slug = (taskName) => `${process.env.AI_WORKFLOW_SLUG}/${taskName}`;
const normStatus = (s) => (s === 'completed' ? 'succeeded' : s);

function jobView(job) {
  if (!job?.runId) return null;
  return { status: job.status, runId: job.runId, queuedAt: job.queuedAt, finishedAt: job.finishedAt || null, error: job.error || null, via: 'render-workflows' };
}

function isActive(job) {
  return job?.runId && !TERMINAL.has(job.status) && Date.now() - new Date(job.queuedAt).getTime() < STALE_JOB_MS;
}

// Queue one learner's AI card. Idempotent per minute, so double clicks reuse the same run.
async function queueCard(menteeId, { force = false } = {}) {
  const run = await render().workflows.startTask(slug('generateAiCard'), [String(menteeId), { force }], {
    idempotencyKey: `card-${menteeId}-${force ? 'f' : 's'}-${Math.floor(Date.now() / 60000)}`,
  });
  const job = { runId: run.taskRunId, status: 'pending', queuedAt: new Date(), finishedAt: null, error: null };
  await Mentee.updateOne({ _id: menteeId }, { $set: { aiJob: job } });
  return job;
}

// Refresh the stored status from Render (only while the run is still in flight).
async function refreshStatus(mentee) {
  const job = mentee.aiJob;
  if (!job?.runId || TERMINAL.has(job.status) || !enabled()) return job || null;
  try {
    const details = await render().workflows.getTaskRun(job.runId);
    const status = normStatus(details.status);
    if (status !== job.status) {
      const set = { 'aiJob.status': status };
      if (TERMINAL.has(status)) {
        set['aiJob.finishedAt'] = details.completedAt ? new Date(details.completedAt) : new Date();
        if (status === 'failed') set['aiJob.error'] = String(details.error || 'Run failed').slice(0, 200);
      }
      await Mentee.updateOne({ _id: mentee._id }, { $set: set });
      const base = typeof job.toObject === 'function' ? job.toObject() : job;
      return { ...base, status, finishedAt: set['aiJob.finishedAt'] || base.finishedAt || null, error: set['aiJob.error'] || job.error };
    }
  } catch (err) {
    console.warn('[aiPipeline] status check failed:', err.message);
  }
  return job;
}

async function queueRefreshAll(options = {}) {
  const run = await render().workflows.startTask(slug('refreshAllCards'), [{ staleHours: options.staleHours ?? 6, limit: options.limit ?? 200 }], {
    idempotencyKey: `refresh-all-${Math.floor(Date.now() / 60000)}`,
  });
  await WorkflowRun.updateOne({ runId: run.taskRunId }, { $setOnInsert: { task: 'refreshAllCards', runId: run.taskRunId, status: 'pending', trigger: options.trigger || 'manual', by: options.by || '', via: 'render-workflows' } }, { upsert: true });
  return { runId: run.taskRunId, status: 'pending' };
}

async function runStatus(runId) {
  const d = await render().workflows.getTaskRun(runId);
  return {
    runId: d.id,
    status: normStatus(d.status),
    results: Array.isArray(d.results) ? d.results[0] ?? null : d.results ?? null,
    error: d.error || null,
    retries: d.retries ?? 0,
    startedAt: d.startedAt || null,
    completedAt: d.completedAt || null,
  };
}

// ------------------------------------------------------------------ //
// Automations: deadline digest, weekly report (+ refresh-all), logged in WorkflowRun
// ------------------------------------------------------------------ //

const AUTOMATIONS = {
  refreshAllCards: { args: () => [{ staleHours: 6, limit: 200 }] },
  deadlineDigest: { args: (o) => [{ hours: o.hours || 48 }] },
  weeklyCohortReport: { args: (o) => [{ programId: o.programId || null }] },
};

// Start an automation on Render Workflows, or run it inline when the pipeline is off
// (local dev) so the feature still works. Returns the WorkflowRun document.
async function startAutomation(taskName, { trigger = 'manual', by = '', options = {} } = {}) {
  if (!AUTOMATIONS[taskName]) throw Object.assign(new Error('Unknown task'), { status: 400 });
  if (enabled()) {
    const run = await render().workflows.startTask(slug(taskName), AUTOMATIONS[taskName].args(options), {
      idempotencyKey: `${taskName}-${trigger}-${Math.floor(Date.now() / 60000)}`,
    });
    return WorkflowRun.findOneAndUpdate(
      { runId: run.taskRunId },
      { $setOnInsert: { task: taskName, runId: run.taskRunId, status: 'pending', trigger, by, via: 'render-workflows' } },
      { upsert: true, new: true }
    );
  }
  if (taskName === 'refreshAllCards') throw Object.assign(new Error('Render Workflows is not configured'), { status: 409 });
  const insights = require('./insights');
  const doc = await WorkflowRun.create({ task: taskName, status: 'running', trigger, by, via: 'inline' });
  try {
    let result;
    if (taskName === 'deadlineDigest') result = await insights.runDeadlineDigest({ hours: options.hours || 48 });
    else {
      const ids = options.programId ? [options.programId] : await insights.programIds();
      const reports = [];
      for (const id of ids) {
        const r = await insights.buildCohortReport(id);
        let summary = 'rules';
        try { await insights.summarizeReport(r._id); summary = 'gemini'; } catch { /* keep rules summary */ }
        reports.push({ reportId: String(r._id), program: r.programName, summary });
      }
      result = { cohorts: reports.length, aiSummaries: reports.filter((r) => r.summary === 'gemini').length, reports };
    }
    Object.assign(doc, { status: 'succeeded', result, finishedAt: new Date() });
  } catch (err) {
    Object.assign(doc, { status: 'failed', error: String(err.message).slice(0, 200), finishedAt: new Date() });
  }
  await doc.save();
  return doc;
}

// Recent runs, refreshing any that are still in flight on Render.
async function recentRuns(limit = 15) {
  const runs = await WorkflowRun.find().sort({ createdAt: -1 }).limit(limit);
  if (enabled()) {
    await Promise.all(runs.filter((r) => r.runId && !TERMINAL.has(r.status)).map(async (r) => {
      try {
        const d = await runStatus(r.runId);
        r.status = d.status;
        r.retries = d.retries;
        if (TERMINAL.has(d.status)) { r.result = d.results; r.error = d.error ? String(d.error).slice(0, 200) : undefined; r.finishedAt = d.completedAt ? new Date(d.completedAt) : new Date(); }
        await r.save();
      } catch (err) { console.warn('[aiPipeline] run refresh failed:', err.message); }
    }));
  }
  return runs;
}

module.exports = { enabled, queueCard, refreshStatus, queueRefreshAll, runStatus, jobView, isActive, startAutomation, recentRuns, AUTOMATIONS };
