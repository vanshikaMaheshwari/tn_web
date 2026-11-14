// Scheduled triggers for the Render Workflow automations.
// A free GitHub Actions schedule (.github/workflows/schedules.yml) calls
//   POST /api/cron/deadlineDigest     every morning
//   POST /api/cron/weeklyCohortReport every Monday
// with the header "x-cron-secret: <CRON_SECRET>". The API then starts the task on
// Render Workflows (or runs it inline if the pipeline isn't configured).
const express = require('express');
const crypto = require('crypto');
const pipeline = require('../services/aiPipeline');
const router = express.Router();

const ALLOWED = new Set(['deadlineDigest', 'weeklyCohortReport', 'refreshAllCards']);

function secretOk(given) {
  const want = process.env.CRON_SECRET || '';
  if (!want || !given) return false;
  const a = Buffer.from(String(given)); const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/:task', async (req, res) => {
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET is not set on the API' });
  if (!secretOk(req.get('x-cron-secret'))) return res.status(401).json({ error: 'Bad cron secret' });
  if (!ALLOWED.has(req.params.task)) return res.status(404).json({ error: 'Unknown task' });
  try {
    const run = await pipeline.startAutomation(req.params.task, { trigger: 'schedule', by: 'schedule' });
    res.status(202).json({ task: run.task, runId: run.runId || null, status: run.status, via: run.via });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

module.exports = router;
