// Public community endpoints: events, feedback, questions (FAQ), Techboard.
const express = require('express');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const Feedback = require('../models/Feedback');
const Query = require('../models/Query');
const Setting = require('../models/Setting');
const Mentee = require('../models/Mentee');
const Mentor = require('../models/Mentor');
const Program = require('../models/Program');
const Resource = require('../models/Resource');
const { levelInfo, avatarTraits } = require('../services/card');

const router = express.Router();
const isId = (x) => /^[a-f0-9]{24}$/i.test(String(x || ''));
const clip = (v, n) => (v === undefined || v === null ? undefined : String(v).trim().slice(0, n));

// Tiny in-memory rate limit for public forms (per IP, per route).
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
    list.push(now);
    hits.set(key, list);
    next();
  };
}

const STATUS_ORDER = { live: 0, upcoming: 1, past: 2, draft: 3 };
function eventView(e, now = Date.now()) {
  const o = e.toObject ? e.toObject() : e;
  const status = (e.status ? e.status(now) : 'past');
  const regClosed = o.registrationClosesAt ? now > new Date(o.registrationClosesAt).getTime() : status === 'past';
  return { ...o, status, registrationOpen: !!o.registerUrl && !regClosed && status !== 'past' };
}
function sortEvents(list) {
  return list.sort((a, b) => {
    if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (a.status === 'past') return new Date(b.startsAt) - new Date(a.startsAt); // newest past first
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return new Date(a.startsAt) - new Date(b.startsAt); // soonest first
  });
}

// ------------------------------------------------------------------ //
// Events
// ------------------------------------------------------------------ //

router.get('/events', async (req, res) => {
  try {
    const events = await Event.find({ published: true });
    const docs = events.map((e) => eventView(e));
    const ratings = await Feedback.aggregate([
      { $match: { source: 'event', event: { $in: events.map((e) => e._id) } } },
      { $group: { _id: '$event', avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);
    const rmap = Object.fromEntries(ratings.map((r) => [String(r._id), { avg: Math.round(r.avg * 10) / 10, count: r.n }]));
    res.json(sortEvents(docs.map((e) => ({ ...e, rating: rmap[String(e._id)] || null }))));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/feedback', limit(10, 10 * 60 * 1000), async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Event not found' });
    const event = await Event.findById(req.params.id);
    if (!event || !event.published) return res.status(404).json({ error: 'Event not found' });
    const rating = Number(req.body?.rating);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Pick a rating from 1 to 5' });
    await Feedback.create({ source: 'event', event: event._id, rating: Math.round(rating), comment: clip(req.body.comment, 500), name: clip(req.body.name, 60) });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Feedback (site-wide tab, or a mission when a mentee is logged in)
// ------------------------------------------------------------------ //

function optionalMentee(req) {
  const t = req.header('x-auth-token');
  if (!t) return null;
  try {
    const d = jwt.verify(t, process.env.JWT_SECRET);
    return d.role === 'mentee' ? d.id : null;
  } catch { return null; }
}

router.post('/feedback', limit(10, 10 * 60 * 1000), async (req, res) => {
  try {
    const rating = Number(req.body?.rating);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Pick a rating from 1 to 5' });
    const source = req.body.source === 'mission' ? 'mission' : 'site';
    const mentee = optionalMentee(req);
    const doc = { source, rating: Math.round(rating), comment: clip(req.body.comment, 500), name: clip(req.body.name, 60), page: clip(req.body.page, 120), mentee: mentee || undefined };
    if (source === 'mission') {
      if (!mentee) return res.status(401).json({ error: 'Log in to rate a mission' });
      if (!isId(req.body.resource) || !(await Resource.exists({ _id: req.body.resource }))) return res.status(400).json({ error: 'Unknown mission' });
      doc.resource = req.body.resource;
    }
    await Feedback.create(doc);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Questions from the FAQ page
// ------------------------------------------------------------------ //

const TOPICS = ['getting-started', 'joining', 'missions', 'ai-card', 'events', 'account', 'other'];

router.post('/queries', limit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const name = clip(req.body?.name, 60);
    const email = clip(req.body?.email, 120)?.toLowerCase();
    const message = clip(req.body?.message, 1000);
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and your question are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    const topic = TOPICS.includes(req.body.topic) ? req.body.topic : 'other';
    const n = (await Query.countDocuments()) + 1;
    const q = await Query.create({ ticket: `TN-Q-${String(n).padStart(4, '0')}`, name, email, topic, message });
    res.status(201).json({ ticket: q.ticket, status: q.status });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Please try again' });
    res.status(500).json({ error: err.message });
  }
});

// Track a question: needs both the ticket and the email it was sent from.
router.get('/queries/track', limit(20, 10 * 60 * 1000), async (req, res) => {
  try {
    const q = await Query.findOne({ ticket: clip(req.query.ticket, 20)?.toUpperCase(), email: clip(req.query.email, 120)?.toLowerCase() })
      .select('ticket status reply repliedAt topic message createdAt').lean();
    if (!q) return res.status(404).json({ error: 'No question found for that ticket and email' });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Techboard: one public board that pulls from everywhere
// ------------------------------------------------------------------ //

router.get('/techboard', async (req, res) => {
  try {
    const now = Date.now();
    const [events, mentees, mentors, programs, announcement, publicCards, scores, recent] = await Promise.all([
      Event.find({ published: true }),
      Mentee.countDocuments(),
      Mentor.countDocuments(),
      Program.find().select('name resources').lean(),
      Setting.findOne({ key: 'announcement' }).lean(),
      Mentee.find({ 'privacy.publicProfile': true }).select('name enrollmentNumber interests streak aiProfile completedResources.score').limit(30).lean(),
      Mentee.aggregate([
        { $project: { name: 1, programs: 1, totalScore: { $sum: '$completedResources.score' }, streak: { $ifNull: ['$streak', 0] } } },
        { $sort: { totalScore: -1, streak: -1 } },
        { $limit: 5 },
      ]),
      Mentee.aggregate([
        { $unwind: '$completedResources' },
        { $match: { 'completedResources.completedOn': { $exists: true } } },
        { $sort: { 'completedResources.completedOn': -1 } },
        { $limit: 8 },
        { $lookup: { from: 'resources', localField: 'completedResources.resource', foreignField: '_id', as: 'r' } },
        { $project: { name: 1, at: '$completedResources.completedOn', title: { $first: '$r.title' }, type: { $first: '$r.type' } } },
      ]),
    ]);

    const evs = sortEvents(events.map((e) => eventView(e, now)));
    const cohortCounts = await Mentee.aggregate([{ $unwind: '$programs' }, { $group: { _id: '$programs', n: { $sum: 1 }, done: { $sum: { $size: { $ifNull: ['$completedResources', []] } } } } }]);
    const cmap = Object.fromEntries(cohortCounts.map((c) => [String(c._id), c]));
    const totalRegistrations = evs.reduce((s, e) => s + (Number(String(e.highlight || '').match(/(\d[\d,]*)\+?\s*registrations/i)?.[1]?.replace(/,/g, '')) || 0), 0);

    const hall = publicCards
      .map((m) => ({ name: m.name, enrollmentNumber: m.enrollmentNumber, interests: m.interests || [], streak: m.streak || 0, archetype: m.aiProfile?.archetype || null, score: (m.completedResources || []).reduce((s, c) => s + (c.score || 0), 0) }))
      .filter((m) => m.archetype)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ interests, streak, ...m }) => {
        const level = levelInfo(m.score).level;
        const avatar = avatarTraits({ interests, topTag: null, skills: { videos: 1, quizzes: 0, projects: 0, consistency: 0, punctuality: 0 }, level, streak, name: m.name });
        return { ...m, level, avatar };
      });

    res.json({
      stats: { mentees, mentors, cohorts: programs.length, events: evs.length, registrations: totalRegistrations || null },
      live: evs.filter((e) => e.status === 'live').slice(0, 1),
      upcoming: evs.filter((e) => e.status === 'upcoming').slice(0, 2),
      photos: evs.filter((e) => e.status === 'past' && e.imageUrl).slice(0, 4).map((e) => ({ title: e.title, imageUrl: e.imageUrl, gallery: e.gallery || [] })),
      leaderboard: scores.map((m, i) => ({ rank: i + 1, name: m.name, totalScore: m.totalScore })),
      cohorts: programs.map((p) => {
        const c = cmap[String(p._id)] || { n: 0, done: 0 };
        const possible = c.n * (p.resources || []).length;
        return { name: p.name, mentees: c.n, missions: (p.resources || []).length, progress: possible ? Math.min(100, Math.round((c.done / possible) * 100)) : 0 };
      }),
      hallOfFame: hall,
      recentWins: recent.filter((r) => r.title).map((r) => ({ name: r.name.split(' ')[0], text: r.type === 'project' ? `shipped “${r.title}”` : r.type === 'quiz' ? `passed “${r.title}”` : `finished “${r.title}”`, at: r.at })),
      announcement: announcement?.value || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.eventView = eventView;
module.exports.sortEvents = sortEvents;
