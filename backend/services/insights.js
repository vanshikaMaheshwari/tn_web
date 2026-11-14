// Cohort automations that run as Render Workflow tasks (see workflows/index.js):
//   runDeadlineDigest  – daily reminders for missions due soon or overdue
//   buildCohortReport  – weekly numbers per cohort
//   summarizeReport    – Gemini write-up of a report (throws so Render retries)
// The API can also call these inline when Render Workflows isn't configured (local dev).
const Mentee = require('../models/Mentee');
const Program = require('../models/Program');
const Quiz = require('../models/Quiz');
const Reminder = require('../models/Reminder');
const CohortReport = require('../models/CohortReport');
const { loadMenteeState, DAY } = require('./menteeState');
const { GEMINI_MODEL, FALLBACK_MODELS, RETRYABLE } = require('./aiProfile');

// Calendar day in India, so "today's reminders" matches what students see.
const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

// ------------------------------------------------------------------ //
// Daily deadline digest
// ------------------------------------------------------------------ //

async function runDeadlineDigest({ hours = 48, programId = null, runId = null } = {}) {
  const now = Date.now();
  const horizon = now + hours * 3600 * 1000;
  const day = istDay();
  const filter = programId ? { programs: programId } : { 'programs.0': { $exists: true } };
  const mentees = await Mentee.find(filter).select('_id').lean();

  let withReminders = 0, dueSoon = 0, overdue = 0;
  const perProgram = {};
  for (const { _id } of mentees) {
    // loadMenteeState gives the exact status the Launchpad shows (incl. locked sub-topics).
    const { programs } = await loadMenteeState(_id);
    const items = [];
    programs.forEach((p) => {
      perProgram[p.name] = perProgram[p.name] || { program: p.name, mentees: 0, withReminders: 0, dueSoon: 0, overdue: 0 };
      perProgram[p.name].mentees += 1;
      const before = items.length;
      p.resources.forEach((r) => {
        if (!['available', 'overdue'].includes(r.status)) return;
        const due = r.closesAt || r.deadline;
        const isOver = r.status === 'overdue';
        if (!isOver && (!due || new Date(due).getTime() > horizon)) return;
        items.push({ resource: r._id, program: p.name, title: r.title, type: r.type, dueAt: due, overdue: isOver, maxScore: r.maxScore });
        perProgram[p.name][isOver ? 'overdue' : 'dueSoon'] += 1;
      });
      if (items.length > before) perProgram[p.name].withReminders += 1;
    });
    items.sort((a, b) => (b.overdue - a.overdue) || (new Date(a.dueAt) - new Date(b.dueAt)));
    if (items.length) {
      withReminders += 1;
      dueSoon += items.filter((i) => !i.overdue).length;
      overdue += items.filter((i) => i.overdue).length;
      await Reminder.updateOne({ mentee: _id, day }, { $set: { items, runId } }, { upsert: true });
    } else {
      await Reminder.deleteOne({ mentee: _id, day });
    }
  }
  return { day, hours, mentees: mentees.length, withReminders, dueSoon, overdue, perProgram: Object.values(perProgram) };
}

// ------------------------------------------------------------------ //
// Weekly cohort report
// ------------------------------------------------------------------ //

async function buildCohortReport(programId, { runId = null, days = 7 } = {}) {
  const program = await Program.findById(programId).populate('resources').lean();
  if (!program) throw new Error(`Program ${programId} not found`);
  const now = Date.now();
  const since = now - days * DAY;
  const resources = program.resources || [];
  const ids = new Set(resources.map((r) => String(r._id)));
  const quizzes = await Quiz.find({ resource: { $in: [...ids] } }).select('resource startTime endTime').lean();
  const quizMap = new Map(quizzes.map((q) => [String(q.resource), q]));
  const mentees = await Mentee.find({ programs: programId }).select('name completedResources lastActiveDate').lean();

  const doneByResource = Object.fromEntries([...ids].map((id) => [id, 0]));
  let completionsWeek = 0, pointsWeek = 0, pendingReviews = 0, totalDone = 0;
  const movers = [];
  const inactive = [];
  mentees.forEach((m) => {
    const mine = (m.completedResources || []).filter((c) => c.resource && ids.has(String(c.resource)));
    let pts = 0, n = 0, last = 0;
    mine.forEach((c) => {
      doneByResource[String(c.resource)] += 1;
      totalDone += 1;
      if (c.submittedOn && !c.verified) pendingReviews += 1;
      const at = new Date(c.completedOn || c.submittedOn || 0).getTime();
      last = Math.max(last, at);
      if (at >= since) { n += 1; pts += c.score || 0; }
    });
    completionsWeek += n;
    pointsWeek += pts;
    if (n) movers.push({ name: m.name, points: pts, missions: n });
    if (!n) inactive.push({ name: m.name, lastActive: last ? new Date(last) : null });
  });

  // Released missions: not a quiz that has yet to open.
  const released = resources.filter((r) => { const q = quizMap.get(String(r._id)); return !(q?.startTime && new Date(q.startTime).getTime() > now); });
  const missionStats = released.map((r) => ({
    title: r.title, type: r.type, done: doneByResource[String(r._id)] || 0, total: mentees.length,
    pct: mentees.length ? Math.round(((doneByResource[String(r._id)] || 0) / mentees.length) * 100) : 0,
  })).sort((a, b) => a.pct - b.pct);
  const nextWeek = resources
    .map((r) => ({ title: r.title, type: r.type, dueAt: quizMap.get(String(r._id))?.endTime || r.deadline }))
    .filter((r) => r.dueAt && new Date(r.dueAt).getTime() > now && new Date(r.dueAt).getTime() < now + 7 * DAY)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  const stats = {
    mentees: mentees.length,
    active: movers.length,
    activePct: mentees.length ? Math.round((movers.length / mentees.length) * 100) : 0,
    completionsWeek,
    pointsWeek,
    completionPct: mentees.length && released.length ? Math.round((totalDone / (mentees.length * released.length)) * 100) : 0,
    pendingReviews,
    topMovers: movers.sort((a, b) => b.points - a.points).slice(0, 3),
    inactive: inactive.sort((a, b) => (a.lastActive?.getTime() || 0) - (b.lastActive?.getTime() || 0)).slice(0, 8),
    inactiveCount: inactive.length,
    hardest: missionStats.filter((m) => m.total > 0).slice(0, 3),
    nextWeek: nextWeek.slice(0, 5),
  };
  const rules = rulesSummary(program.name, stats);
  const report = await CohortReport.create({
    program: program._id, programName: program.name, periodStart: new Date(since), periodEnd: new Date(now),
    stats, summary: rules.summary, highlights: rules.highlights, summarySource: 'rules', runId,
  });
  return report;
}

function rulesSummary(name, s) {
  const lines = [];
  lines.push(`${s.active} of ${s.mentees} mentees in ${name} finished at least one mission this week (${s.activePct}%), earning ${s.pointsWeek} points across ${s.completionsWeek} missions.`);
  if (s.topMovers[0]) lines.push(`${s.topMovers[0].name} led the week with ${s.topMovers[0].points} points.`);
  if (s.hardest[0] && s.hardest[0].pct < 60) lines.push(`"${s.hardest[0].title}" has the lowest completion (${s.hardest[0].pct}%), so it may need a nudge or a walkthrough.`);
  const highlights = [];
  if (s.inactiveCount) highlights.push(`Check in with ${s.inactiveCount} inactive mentee${s.inactiveCount > 1 ? 's' : ''}.`);
  if (s.pendingReviews) highlights.push(`${s.pendingReviews} project${s.pendingReviews > 1 ? 's' : ''} waiting for review.`);
  if (s.nextWeek[0]) highlights.push(`Next deadline: ${s.nextWeek[0].title}.`);
  return { summary: lines.join(' '), highlights };
}

// ------------------------------------------------------------------ //
// Gemini write-up for a report (throws on failure so Render retries)
// ------------------------------------------------------------------ //

const REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    highlights: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'highlights'],
};

function reportPrompt(name, s) {
  return `You are the assistant for a student tech mentorship program (TechNeeds, IGDTUW).
Write a short weekly report for the mentors of the cohort "${name}".
Use ONLY these numbers. Do not invent names, numbers or events.
${JSON.stringify(s)}
Return JSON: "summary" = 2-3 friendly, specific sentences (max 70 words) on how the week went;
"highlights" = 2-4 short action items for mentors (max 14 words each), e.g. who to nudge or which mission to revisit.`;
}

async function summarizeReport(reportId) {
  const report = await CohortReport.findById(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { reportId: String(reportId), skipped: 'no GEMINI_API_KEY' };
  const models = [GEMINI_MODEL(), ...FALLBACK_MODELS()].filter((m, i, a) => a.indexOf(m) === i);
  let lastErr;
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: reportPrompt(report.programName, report.stats) }] }],
          generationConfig: { temperature: 0.5, responseMimeType: 'application/json', responseSchema: REPORT_SCHEMA },
        }),
      });
      if (!res.ok) {
        const err = new Error(`Gemini ${res.status} (${model})`);
        err.retryable = RETRYABLE.has(res.status);
        throw err;
      }
      const data = await res.json();
      const out = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '{}');
      if (!out.summary) throw Object.assign(new Error('Empty summary'), { retryable: true });
      report.summary = String(out.summary).slice(0, 600);
      report.highlights = (out.highlights || []).map((h) => String(h).slice(0, 140)).slice(0, 4);
      report.summarySource = 'gemini';
      report.model = model;
      await report.save();
      return { reportId: String(reportId), model };
    } catch (err) {
      lastErr = err;
      if (err.retryable === false) break;
    }
  }
  throw lastErr;
}

async function programIds() {
  return (await Program.find().select('_id').lean()).map((p) => String(p._id));
}

module.exports = { runDeadlineDigest, buildCohortReport, summarizeReport, programIds, istDay };
