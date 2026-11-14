const express = require('express');
const bcrypt = require('bcryptjs');
const Mentee = require('../models/Mentee');
const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');
const Program = require('../models/Program');
const Resource = require('../models/Resource');
const { authenticateMentee, signToken } = require('../middleware/authMentor');
const { generateProfile } = require('../services/aiProfile');
const { loadMenteeState, buildStats, calculateRank } = require('../services/menteeState');
const { buildCard } = require('../services/card');
const pipeline = require('../services/aiPipeline');
const Reminder = require('../models/Reminder');
const router = express.Router();

const DAY = 86400000;
const AI_CACHE_MS = 6 * 60 * 60 * 1000; // regenerate at most every 6h unless forced
const AI_FORCE_COOLDOWN_MS = 60 * 1000;

const isBcryptHash = (s) => typeof s === 'string' && /^\$2[aby]\$\d{2}\$/.test(s);
const inProgram = (mentee, resource) =>
  mentee.programs.some((p) => (p._id || p).toString() === resource.program.toString());

// ------------------------------------------------------------------ //
// Auth
// ------------------------------------------------------------------ //

router.post('/login', async (req, res) => {
  const { enrollmentNumber, password } = req.body;
  try {
    const mentee = await Mentee.findOne({ enrollmentNumber: (enrollmentNumber || '').trim() });
    if (!mentee) return res.status(400).json({ error: 'Invalid credentials' });

    let ok = false;
    if (isBcryptHash(mentee.password)) {
      ok = await bcrypt.compare(password || '', mentee.password);
    } else if (password && password === mentee.password) {
      // Legacy plain-text password from the old system: accept once, then hash it.
      ok = true;
      mentee.password = await bcrypt.hash(password, 10);
      await mentee.save();
    }
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(mentee._id, 'mentee'), name: mentee.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/change-password', authenticateMentee, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const mentee = await Mentee.findById(req.mentee._id);
    const ok = isBcryptHash(mentee.password)
      ? await bcrypt.compare(currentPassword || '', mentee.password)
      : currentPassword === mentee.password;
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    mentee.password = await bcrypt.hash(newPassword, 10);
    await mentee.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Dashboard
// ------------------------------------------------------------------ //


// Today's reminders from the "deadlineDigest" Render Workflow task (finished ones hidden).
router.get('/reminders', authenticateMentee, async (req, res) => {
  try {
    const r = await Reminder.findOne({ mentee: req.mentee._id, createdAt: { $gte: new Date(Date.now() - 30 * 3600 * 1000) } }).sort({ createdAt: -1 }).lean();
    if (!r) return res.json(null);
    const mentee = await Mentee.findById(req.mentee._id).select('completedResources.resource').lean();
    const done = new Set((mentee?.completedResources || []).map((c) => String(c.resource)));
    const items = r.items.filter((i) => !done.has(String(i.resource)));
    res.json({ day: r.day, generatedAt: r.updatedAt || r.createdAt, items, via: r.runId ? 'render-workflows' : 'inline' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', authenticateMentee, async (req, res) => {
  try {
    const { mentee, programs, totalScore } = await loadMenteeState(req.mentee._id);
    const totalMentees = await Mentee.countDocuments();
    res.json({
      id: mentee._id,
      name: mentee.name,
      email: mentee.email,
      enrollmentNumber: mentee.enrollmentNumber,
      interests: mentee.interests || [],
      streak: mentee.streak,
      lastActiveDate: mentee.lastActiveDate,
      totalScore,
      rank: await calculateRank(mentee._id),
      totalMentees,
      programs,
      completedResources: mentee.completedResources.map((c) => ({
        resource: c.resource,
        score: c.score,
        completedOn: c.completedOn || c.submittedOn,
        verified: c.verified,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Resource completion (videos only — quizzes and projects have their own
// flows; previously any resource could be "marked done" for full marks)
// ------------------------------------------------------------------ //

// Missions in a sub-topic marked "lock until previous" stay closed until the previous one is done.
async function lockedBySubtopic(menteeId, resource) {
  if (!resource.subtopic) return false;
  const { programs } = await loadMenteeState(menteeId);
  const r = programs.flatMap((p) => p.resources).find((x) => String(x._id) === String(resource._id));
  return r?.status === 'locked' && r.lockedReason === 'previous_subtopic';
}

router.post('/resources/:id/complete', authenticateMentee, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    const mentee = req.mentee;
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (!inProgram(mentee, resource)) return res.status(403).json({ error: 'Not enrolled in this program' });
    if (resource.isLocked) return res.status(403).json({ error: 'Resource is locked' });
    if (await lockedBySubtopic(req.mentee._id, resource)) return res.status(403).json({ error: 'Finish the previous sub-topic first' });
    if (resource.type !== 'video') {
      return res.status(400).json({ error: `Use the ${resource.type} flow to complete this resource` });
    }

    const already = mentee.completedResources.find((c) => c.resource.toString() === resource._id.toString());
    if (already) return res.status(409).json({ error: 'Already completed', score: already.score });

    const isLate = resource.deadline && new Date() > resource.deadline;
    const latePenalty = isLate ? Math.floor((Date.now() - resource.deadline) / DAY) : 0; // 1 pt/day
    const score = Math.max(0, resource.maxScore - latePenalty);

    mentee.completedResources.push({ resource: resource._id, score, completedOn: new Date(), verified: true });
    updateStreak(mentee);
    await mentee.save();

    res.json({ message: 'Resource marked as completed!', score, latePenalty, streak: mentee.streak });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Quiz
// ------------------------------------------------------------------ //

router.get('/resources/:id/quiz', authenticateMentee, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource || resource.type !== 'quiz') return res.status(400).json({ error: 'Invalid quiz resource' });
    if (!inProgram(req.mentee, resource)) return res.status(403).json({ error: 'Not enrolled in this program' });

    const quiz = await Quiz.findOne({ resource: resource._id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const now = new Date();
    if (quiz.startTime && now < quiz.startTime) return res.status(403).json({ error: 'Quiz has not opened yet' });
    if (quiz.endTime && now > quiz.endTime) return res.status(403).json({ error: 'Quiz is closed' });

    res.json({
      title: resource.title,
      description: resource.description,
      endTime: quiz.endTime,
      maxScore: resource.maxScore,
      // correct answers are never sent to the client
      questions: quiz.questions.map((q) => ({ id: q._id, questionText: q.questionText, options: q.options, marks: q.marks })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resources/:id/quiz/submit', authenticateMentee, async (req, res) => {
  try {
    const resourceId = req.params.id;
    const mentee = req.mentee;
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

    const resource = await Resource.findById(resourceId);
    if (!resource || resource.type !== 'quiz') return res.status(400).json({ error: 'Invalid quiz resource' });
    if (!inProgram(mentee, resource)) return res.status(403).json({ error: 'Not enrolled in this program' });
    if (resource.isLocked) return res.status(403).json({ error: 'Quiz is locked' });
    if (await lockedBySubtopic(req.mentee._id, resource)) return res.status(403).json({ error: 'Finish the previous sub-topic first' });

    const quiz = await Quiz.findOne({ resource: resourceId });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const now = new Date();
    if ((quiz.startTime && now < quiz.startTime) || (quiz.endTime && now > quiz.endTime)) {
      return res.status(403).json({ error: 'Quiz is not active at this time' });
    }
    if (await QuizSubmission.findOne({ quiz: quiz._id, mentee: mentee._id })) {
      return res.status(409).json({ error: 'Quiz already submitted' });
    }

    let totalScore = 0;
    let correct = 0;
    for (const question of quiz.questions) {
      const a = answers.find((x) => String(x.questionId) === question._id.toString());
      if (a && Number(a.selectedOptionIndex) === question.correctOptionIndex) {
        totalScore += question.marks || 1;
        correct += 1;
      }
    }

    await new QuizSubmission({ quiz: quiz._id, resource: resourceId, mentee: mentee._id, answers, score: totalScore }).save();

    mentee.completedResources.push({ resource: resource._id, score: totalScore, completedOn: new Date(), verified: true });
    updateStreak(mentee);
    await mentee.save();

    res.status(200).json({
      message: 'Quiz submitted successfully!',
      score: totalScore,
      maxScore: resource.maxScore,
      correct,
      total: quiz.questions.length,
      streak: mentee.streak,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Project submission
// ------------------------------------------------------------------ //

router.post('/resources/:resourceId/project', authenticateMentee, async (req, res) => {
  try {
    const { githubLink, deployedLink, description } = req.body;
    const resource = await Resource.findById(req.params.resourceId);
    const mentee = req.mentee;

    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (resource.type !== 'project') return res.status(400).json({ error: 'Invalid resource type' });
    if (!inProgram(mentee, resource)) return res.status(403).json({ error: 'Not enrolled in this program' });
    if (resource.isLocked) return res.status(403).json({ error: 'Resource is locked' });
    if (await lockedBySubtopic(req.mentee._id, resource)) return res.status(403).json({ error: 'Finish the previous sub-topic first' });
    if (!githubLink || !deployedLink || !description) return res.status(400).json({ error: 'All fields are required' });

    const urlOk = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
    if (!urlOk(githubLink) || !urlOk(deployedLink)) return res.status(400).json({ error: 'Links must be valid http(s) URLs' });

    const existing = mentee.completedResources.find((c) => c.resource.toString() === resource._id.toString());
    if (existing && existing.verified) return res.status(409).json({ error: 'This project has already been reviewed' });

    const entry = { githubLink, deployedLink, description, submittedOn: new Date(), completedOn: new Date(), score: 0, verified: false };
    if (existing) Object.assign(existing, entry);
    else mentee.completedResources.push({ resource: resource._id, ...entry });

    updateStreak(mentee);
    await mentee.save();
    res.json({ message: 'Project submitted! Your mentor will review and score it.', status: 'pending_review' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------------------------------------------ //
// Interests + AI profile
// ------------------------------------------------------------------ //

router.put('/interests', authenticateMentee, async (req, res) => {
  try {
    const raw = Array.isArray(req.body.interests) ? req.body.interests : [];
    const interests = [...new Set(
      raw.map((s) => String(s).toLowerCase().trim().replace(/^#/, '').replace(/\s+/g, '_').replace(/[^a-z0-9_+.#-]/g, ''))
        .filter(Boolean)
    )].slice(0, 12);
    await Mentee.updateOne({ _id: req.mentee._id }, { $set: { interests }, $unset: { aiProfileAt: 1 } });
    res.json({ interests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/profile', authenticateMentee, async (req, res) => {
  try {
    const { mentee, stats, timeline } = await buildStats(req.mentee._id);
    res.json({
      name: mentee.name,
      email: mentee.email,
      enrollmentNumber: mentee.enrollmentNumber,
      memberSince: mentee.createdAt,
      stats,
      timeline,
      ai: mentee.aiProfile || null,
      aiGeneratedAt: mentee.aiProfileAt || null,
      aiSource: mentee.aiProfileSource || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/profile/ai', authenticateMentee, async (req, res) => {
  try {
    const force = !!req.body?.force;
    const fresh = await Mentee.findById(req.mentee._id).select('aiProfile aiProfileAt aiProfileSource');
    const age = fresh.aiProfileAt ? Date.now() - fresh.aiProfileAt.getTime() : Infinity;

    if (fresh.aiProfile && (age < AI_FORCE_COOLDOWN_MS || (!force && age < AI_CACHE_MS))) {
      return res.json({ ai: fresh.aiProfile, aiGeneratedAt: fresh.aiProfileAt, aiSource: fresh.aiProfileSource, cached: true });
    }

    const { stats } = await buildStats(req.mentee._id);
    const { profile, source, model } = await generateProfile(stats);
    const at = new Date();
    await Mentee.updateOne({ _id: req.mentee._id }, { $set: { aiProfile: { ...profile, model }, aiProfileAt: at, aiProfileSource: source, aiProfileModel: model } });
    res.json({ ai: profile, aiGeneratedAt: at, aiSource: source, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Helpers
// ------------------------------------------------------------------ //


function updateStreak(mentee) {
  const today = new Date().toDateString();
  const lastActive = mentee.lastActiveDate?.toDateString();
  if (lastActive !== today) {
    mentee.streak = lastActive === new Date(Date.now() - DAY).toDateString() ? (mentee.streak || 0) + 1 : 1;
    mentee.lastActiveDate = new Date();
  }
}

// ------------------------------------------------------------------ //
// Public leaderboard (optionally filtered by ?program=<id>)
// ------------------------------------------------------------------ //

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const skip = Math.max(parseInt(req.query.skip || '0', 10), 0);
    const match = {};
    if (req.query.program && /^[a-f0-9]{24}$/i.test(req.query.program)) {
      match.programs = new (require('mongoose').Types.ObjectId)(req.query.program);
    }

    const rows = await Mentee.aggregate([
      { $match: match },
      {
        $project: {
          name: 1,
          interests: 1,
          streak: { $ifNull: ['$streak', 0] },
          lastActiveDate: { $ifNull: ['$lastActiveDate', new Date(0)] },
          completed: { $size: { $ifNull: ['$completedResources', []] } },
          totalScore: { $sum: { $map: { input: { $ifNull: ['$completedResources', []] }, as: 'cr', in: { $ifNull: ['$$cr.score', 0] } } } },
        },
      },
      { $sort: { totalScore: -1, streak: -1, lastActiveDate: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    res.json(rows.map((m, i) => ({
      id: m._id,
      rank: skip + i + 1,
      name: m.name,
      totalScore: m.totalScore || 0,
      streak: m.streak || 0,
      completed: m.completed || 0,
      interests: (m.interests || []).slice(0, 3),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------------------------------------------ //
// AI card v2
// ------------------------------------------------------------------ //

const lastForce = new Map(); // menteeId -> timestamp (per-instance cooldown)

router.get('/card', authenticateMentee, async (req, res) => {
  try {
    res.json(await buildCard(req.mentee._id, { mode: 'self' }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/card/ai', authenticateMentee, async (req, res) => {
  try {
    const id = String(req.mentee._id);
    const last = lastForce.get(id) || 0;
    const allowed = Date.now() - last > AI_FORCE_COOLDOWN_MS;
    if (allowed) lastForce.set(id, Date.now());
    const card = await buildCard(req.mentee._id, { mode: 'self', forceAi: allowed });
    res.json({ ...card, cooldown: !allowed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Status of the learner's AI card run on Render Workflows (polled by the card page).
router.get('/card/ai/status', authenticateMentee, async (req, res) => {
  try {
    const mentee = await Mentee.findById(req.mentee._id).select('aiJob aiProfileSource aiProfileAt aiProfileModel');
    const job = await pipeline.refreshStatus(mentee);
    res.json({
      pipeline: pipeline.enabled() ? 'render-workflows' : 'inline',
      job: pipeline.jobView(job),
      aiSource: mentee.aiProfileSource || null,
      aiModel: mentee.aiProfileModel || null,
      aiGeneratedAt: mentee.aiProfileAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/privacy', authenticateMentee, async (req, res) => {
  try {
    const set = {};
    ['publicProfile', 'showRank', 'recruiterVisible'].forEach((k) => {
      if (typeof req.body?.[k] === 'boolean') set[`privacy.${k}`] = req.body[k];
    });
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });
    const m = await Mentee.findByIdAndUpdate(req.mentee._id, { $set: set }, { new: true }).select('privacy enrollmentNumber');
    res.json({ privacy: m.privacy, enrollmentNumber: m.enrollmentNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public, opt-in profile: /u/TN-WEBD-0004 (404 unless the mentee switched it on)
router.get('/u/:enrollment', async (req, res) => {
  try {
    const enrollment = String(req.params.enrollment || '').toUpperCase().slice(0, 40);
    const m = await Mentee.findOne({ enrollmentNumber: enrollment }).select('_id privacy');
    if (!m || !m.privacy?.publicProfile) return res.status(404).json({ error: 'This profile is private or does not exist' });
    res.json(await buildCard(m._id, { mode: 'public' }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/programs/public', async (req, res) => {
  const programs = await Program.find().select('name').lean();
  res.json(programs);
});

module.exports = router;
