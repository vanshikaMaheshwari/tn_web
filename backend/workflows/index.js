// TechNeeds AI pipeline on Render Workflows.
//
// Deployed as its own Render "Workflow" service (root: backend, start: node workflows/index.js).
// The web API queues runs with the Render SDK; Render spins up compute for each run,
// retries failed attempts with backoff (e.g. when Gemini returns 503 "high demand"),
// and scales to zero when nothing is running.
//
// Tasks
//   generateAiCard(menteeId, { force })    – one learner's AI card, saved to MongoDB
//   refreshAllCards({ staleHours, limit })   – fans out generateAiCard over stale cards
//   deadlineDigest({ hours })                – daily: reminders for missions due soon / overdue
//   weeklyCohortReport({ programId })        – weekly: numbers per cohort, then chains
//   summarizeCohortReport(reportId)          –   a Gemini write-up of each report (retried)
require('dotenv').config();
const mongoose = require('mongoose');
const { task } = require('@renderinc/sdk/workflows');
const Mentee = require('../models/Mentee');
const { buildStats } = require('../services/menteeState');
const { generateWithGemini } = require('../services/aiProfile');
const insights = require('../services/insights');

const SIX_HOURS = 6 * 3600 * 1000;

async function connect() {
  if (mongoose.connection.readyState === 1) return;
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set on the workflow service');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
}

const generateAiCard = task(
  {
    name: 'generateAiCard',
    // 1 try + 4 retries, waiting 5s, 10s, 20s, 40s: rides out short Gemini outages.
    retry: { maxRetries: 4, waitDurationMs: 5000, backoffScaling: 2 },
    timeoutSeconds: 180,
    plan: 'flex',
  },
  async function generateAiCard(ctx, menteeId, options = {}) {
    await connect();
    const { mentee, stats } = await buildStats(menteeId);

    const fresh = mentee.aiProfileSource === 'gemini' && mentee.aiProfileAt &&
      Date.now() - new Date(mentee.aiProfileAt).getTime() < SIX_HOURS;
    if (fresh && !options.force) {
      await Mentee.updateOne({ _id: mentee._id }, { $set: { 'aiJob.status': 'succeeded', 'aiJob.finishedAt': new Date() } });
      return { menteeId: String(mentee._id), skipped: true };
    }

    // Throws if Gemini (and every fallback model) fails, so Render retries this run.
    const { profile, model } = await generateWithGemini(stats);
    const at = new Date();
    await Mentee.updateOne(
      { _id: mentee._id },
      {
        $set: {
          aiProfile: { ...profile, model },
          aiProfileAt: at,
          aiProfileSource: 'gemini',
          aiProfileModel: model,
          'aiJob.status': 'succeeded',
          'aiJob.finishedAt': at,
          'aiJob.error': null,
        },
      }
    );
    return { menteeId: String(mentee._id), model, archetype: profile.archetype };
  }
);

const refreshAllCards = task(
  { name: 'refreshAllCards', timeoutSeconds: 1800, plan: 'flex' },
  async function refreshAllCards(ctx, options = {}) {
    await connect();
    const staleBefore = new Date(Date.now() - (options.staleHours ?? 6) * 3600 * 1000);
    const docs = await Mentee.find({
      $or: [
        { aiProfileAt: { $exists: false } },
        { aiProfileAt: { $lt: staleBefore } },
        { aiProfileSource: { $ne: 'gemini' } },
      ],
    }).select('_id').limit(Math.min(options.limit || 200, 500)).lean();

    const ids = docs.map((d) => String(d._id));
    let succeeded = 0;
    const failed = [];
    // Small batches keep us under Gemini's free-tier rate limits.
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map((id) => ctx.run(generateAiCard, id, { force: true })));
      results.forEach((r, j) => (r.status === 'fulfilled' ? succeeded++ : failed.push(batch[j])));
    }
    return { checked: ids.length, succeeded, failed: failed.length, failedIds: failed.slice(0, 20) };
  }
);

// ------------------------------------------------------------------ //
// Cohort automations
// ------------------------------------------------------------------ //

const deadlineDigest = task(
  {
    name: 'deadlineDigest',
    retry: { maxRetries: 2, waitDurationMs: 10000, backoffScaling: 2 },
    timeoutSeconds: 900,
    plan: 'flex',
  },
  async function deadlineDigest(ctx, options = {}) {
    await connect();
    const hours = Math.max(6, Math.min(Number(options.hours) || 48, 168));
    return insights.runDeadlineDigest({ hours, programId: options.programId || null, runId: options.runId || null });
  }
);

// Gemini write-up for one report. Throws if every model fails, so Render retries it;
// the report already has a rules-based summary, so a failure here never loses data.
const summarizeCohortReport = task(
  {
    name: 'summarizeCohortReport',
    retry: { maxRetries: 4, waitDurationMs: 5000, backoffScaling: 2 },
    timeoutSeconds: 180,
    plan: 'flex',
  },
  async function summarizeCohortReport(ctx, reportId) {
    await connect();
    return insights.summarizeReport(reportId);
  }
);

const weeklyCohortReport = task(
  {
    name: 'weeklyCohortReport',
    retry: { maxRetries: 2, waitDurationMs: 10000, backoffScaling: 2 },
    timeoutSeconds: 1800,
    plan: 'flex',
  },
  async function weeklyCohortReport(ctx, options = {}) {
    await connect();
    const ids = options.programId ? [String(options.programId)] : await insights.programIds();
    const reports = [];
    for (const id of ids) {
      const report = await insights.buildCohortReport(id, { runId: options.runId || null });
      reports.push({ reportId: String(report._id), program: report.programName });
    }
    // Chain one summary subtask per report; they run in parallel and retry on their own.
    const results = await Promise.allSettled(reports.map((r) => ctx.run(summarizeCohortReport, r.reportId)));
    return {
      cohorts: reports.length,
      aiSummaries: results.filter((r) => r.status === 'fulfilled').length,
      reports: reports.map((r, i) => ({ ...r, summary: results[i].status === 'fulfilled' ? 'gemini' : 'rules' })),
    };
  }
);

module.exports = { generateAiCard, refreshAllCards, deadlineDigest, weeklyCohortReport, summarizeCohortReport };
