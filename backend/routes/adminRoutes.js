const express = require('express');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Program = require('../models/Program');
const Resource = require('../models/Resource');
const { authenticateAdmin } = require('../middleware/authMentor');
const pipeline = require('../services/aiPipeline');
const Event = require('../models/Event');
const Feedback = require('../models/Feedback');
const Query = require('../models/Query');
const Setting = require('../models/Setting');
const Reminder = require('../models/Reminder');
const CohortReport = require('../models/CohortReport');
const { istDay } = require('../services/insights');
const { eventView, sortEvents } = require('./communityRoutes');
const router = express.Router();

// Admin is a core-team permission on mentor accounts (see middleware/authMentor.js).
// The old shared ADMIN_EMAIL/ADMIN_PASSWORD login was removed on purpose.
router.post('/login', (req, res) => res.status(410).json({ error: 'Admin login moved: core-team members log in as mentors.' }));

router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const [programs, mentors, mentees, resources] = await Promise.all([
      Program.countDocuments(),
      Mentor.countDocuments(),
      Mentee.countDocuments(),
      Resource.countDocuments(),
    ]);
    const [unassignedPrograms, geminiCards, freshCards] = await Promise.all([
      Program.countDocuments({ mentors: { $size: 0 } }),
      Mentee.countDocuments({ aiProfileSource: 'gemini' }),
      Mentee.countDocuments({ aiProfileSource: 'gemini', aiProfileAt: { $gte: new Date(Date.now() - 6 * 3600 * 1000) } }),
    ]);
    res.json({
      programs, mentors, mentees, resources, unassignedPrograms,
      ai: { pipeline: pipeline.enabled() ? 'render-workflows' : 'inline', geminiCards, freshCards },
      inbox: { openQueries: await Query.countDocuments({ status: 'open' }) },
      announcement: (await Setting.findOne({ key: 'announcement' }).lean())?.value || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// AI pipeline (Render Workflows)
// ------------------------------------------------------------------ //

router.post('/ai/refresh-all', authenticateAdmin, async (req, res) => {
  if (!pipeline.enabled()) {
    return res.status(409).json({ error: 'Render Workflows is not configured (set RENDER_API_KEY and AI_WORKFLOW_SLUG on the API service).' });
  }
  try {
    const staleHours = Math.max(0, Math.min(Number(req.body?.staleHours ?? 6), 168));
    res.status(202).json(await pipeline.queueRefreshAll({ staleHours, by: req.mentor.name }));
  } catch (err) {
    console.error('[aiPipeline] refresh-all failed:', err.message);
    res.status(502).json({ error: `Could not start the workflow run: ${err.message}` });
  }
});

router.get('/ai/runs/:runId', authenticateAdmin, async (req, res) => {
  if (!pipeline.enabled()) return res.status(409).json({ error: 'Render Workflows is not configured' });
  if (!/^trn-[a-z0-9]+$/i.test(req.params.runId)) return res.status(400).json({ error: 'Invalid run id' });
  try {
    res.json(await pipeline.runStatus(req.params.runId));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Automations (Render Workflows): deadline digest, weekly report, AI refresh
// ------------------------------------------------------------------ //

router.get('/automations', authenticateAdmin, async (req, res) => {
  try {
    const [runs, remindersToday, reports] = await Promise.all([
      pipeline.recentRuns(15),
      Reminder.countDocuments({ day: istDay() }),
      CohortReport.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$program', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { programName: 1 } },
      ]),
    ]);
    res.json({
      pipeline: pipeline.enabled() ? 'render-workflows' : 'inline',
      scheduled: Boolean(process.env.CRON_SECRET),
      runs,
      remindersToday,
      reports,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/automations/:task', authenticateAdmin, async (req, res) => {
  try {
    const run = await pipeline.startAutomation(req.params.task, { trigger: 'manual', by: req.mentor.name, options: req.body || {} });
    res.status(202).json(run);
  } catch (err) {
    console.error('[automations] start failed:', err.message);
    res.status(err.status || 502).json({ error: err.status ? err.message : `Could not start the workflow run: ${err.message}` });
  }
});

// ------------------------------------------------------------------ //
// Core team: mentors' core-team permission
// ------------------------------------------------------------------ //

router.put('/mentors/:id/core', authenticateAdmin, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Mentor not found' });
    if (String(req.params.id) === String(req.mentor._id) && req.body?.isAdmin === false) {
      return res.status(400).json({ error: 'You can’t remove your own core-team access' });
    }
    const m = await Mentor.findByIdAndUpdate(req.params.id, { $set: { isAdmin: !!req.body?.isAdmin } }, { new: true }).select('name email isAdmin');
    if (!m) return res.status(404).json({ error: 'Mentor not found' });
    res.json(m);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Events
// ------------------------------------------------------------------ //

const EVENT_FIELDS = ['title', 'type', 'description', 'startsAt', 'endsAt', 'dateLabel', 'mode', 'venue', 'registerUrl', 'registrationClosesAt', 'imageUrl', 'recapUrl', 'highlight', 'color', 'featured', 'published'];
function eventInput(body = {}) {
  const out = {};
  EVENT_FIELDS.forEach((k) => { if (body[k] !== undefined) out[k] = body[k] === '' ? undefined : body[k]; });
  if (body.tracks !== undefined) out.tracks = (Array.isArray(body.tracks) ? body.tracks : String(body.tracks).split(',')).map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
  if (body.gallery !== undefined) out.gallery = (Array.isArray(body.gallery) ? body.gallery : String(body.gallery).split('\n')).map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  ['registerUrl', 'imageUrl', 'recapUrl'].forEach((k) => {
    if (out[k] && !/^(https?:\/\/|\/)/i.test(out[k])) out[k] = `https://${out[k]}`;
  });
  return out;
}

router.get('/events', authenticateAdmin, async (req, res) => {
  try {
    const events = await Event.find();
    res.json(sortEvents(events.map((e) => eventView(e))));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events', authenticateAdmin, async (req, res) => {
  try {
    const data = eventInput(req.body);
    if (!data.title || !data.startsAt) return res.status(400).json({ error: 'Title and start date are required' });
    const e = await Event.create({ ...data, createdBy: req.mentor._id });
    res.status(201).json(eventView(e));
  } catch (err) {
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
  }
});

router.put('/events/:id', authenticateAdmin, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Event not found' });
    const e = await Event.findById(req.params.id);
    if (!e) return res.status(404).json({ error: 'Event not found' });
    Object.assign(e, eventInput(req.body));
    await e.save();
    res.json(eventView(e));
  } catch (err) {
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
  }
});

router.delete('/events/:id', authenticateAdmin, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Event not found' });
    await Event.deleteOne({ _id: req.params.id });
    await Feedback.deleteMany({ event: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Inbox: questions + feedback
// ------------------------------------------------------------------ //

router.get('/queries', authenticateAdmin, async (req, res) => {
  try {
    const filter = ['open', 'answered', 'resolved'].includes(req.query.status) ? { status: req.query.status } : {};
    const [items, open] = await Promise.all([
      Query.find(filter).sort({ status: 1, createdAt: -1 }).limit(200).lean(),
      Query.countDocuments({ status: 'open' }),
    ]);
    res.json({ items, open });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/queries/:id', authenticateAdmin, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Question not found' });
    const q = await Query.findById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    if (req.body.reply !== undefined) {
      q.reply = String(req.body.reply).slice(0, 2000);
      q.repliedBy = req.mentor.name;
      q.repliedAt = new Date();
      if (q.status === 'open' && q.reply.trim()) q.status = 'answered';
    }
    if (['open', 'answered', 'resolved'].includes(req.body.status)) q.status = req.body.status;
    await q.save();
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/feedback', authenticateAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [items, agg] = await Promise.all([
      Feedback.find().sort({ createdAt: -1 }).limit(100).populate('event', 'title').populate('resource', 'title').populate('mentee', 'name').lean(),
      Feedback.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    ]);
    res.json({
      items: items.map((f) => ({
        _id: f._id, source: f.source, rating: f.rating, comment: f.comment || '', createdAt: f.createdAt,
        about: f.source === 'event' ? f.event?.title : f.source === 'mission' ? f.resource?.title : f.page || 'Website',
        who: f.mentee?.name || f.name || 'anonymous',
      })),
      month: agg[0] ? { avg: Math.round(agg[0].avg * 10) / 10, count: agg[0].n } : { avg: null, count: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Techboard announcement
// ------------------------------------------------------------------ //

router.put('/announcement', authenticateAdmin, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim().slice(0, 200);
    if (!text) {
      await Setting.deleteOne({ key: 'announcement' });
      return res.json({ announcement: null });
    }
    const value = { text, by: req.mentor.name, at: new Date() };
    await Setting.updateOne({ key: 'announcement' }, { $set: { value, updatedBy: req.mentor.email } }, { upsert: true });
    res.json({ announcement: value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
