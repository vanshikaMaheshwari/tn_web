const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Mentor = require('../models/Mentor');
const Program = require('../models/Program');
const Resource = require('../models/Resource');
const Mentee = require('../models/Mentee');
const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');
const {
  authenticate,
  authenticateAdmin,
  authenticateStaff,
  signToken,
  mentorOwnsProgram,
  isCoreTeam,
} = require('../middleware/authMentor');
const Module = require('../models/Module');
const CohortReport = require('../models/CohortReport');
const { buildCard } = require('../services/card');
const router = express.Router();

// Readable random password, e.g. "tn-k7f9d2xq"
const generatePassword = () => 'tn-' + crypto.randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();

const sanitizeMentor = (m) => {
  const obj = m.toObject ? m.toObject() : { ...m };
  delete obj.password;
  obj.isCoreTeam = isCoreTeam(m);
  return obj;
};

// ------------------------------------------------------------------ //
// Admin-only: mentors & programs
// ------------------------------------------------------------------ //

// Create mentor — password auto-generated if not supplied, returned ONCE.
router.post('/mentors', authenticateAdmin, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    if (await Mentor.findOne({ email: email.toLowerCase().trim() })) {
      return res.status(409).json({ error: 'A mentor with this email already exists' });
    }
    const tempPassword = req.body.password || generatePassword();
    const mentor = new Mentor({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: await bcrypt.hash(tempPassword, 10),
    });
    await mentor.save();
    res.status(201).json({ mentor: sanitizeMentor(mentor), tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mentors', authenticateAdmin, async (req, res) => {
  try {
    const mentors = await Mentor.find().select('-password').populate('programs', 'name');
    res.json(mentors.map(sanitizeMentor));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin sees all programs; a mentor sees only their own.
router.get('/programs', authenticateStaff, async (req, res) => {
  try {
    // Core team asking for ?all=1 (Command deck) sees every program; mentors see their own.
    const all = req.admin && String(req.query.all) === '1';
    const filter = all ? {} : { _id: { $in: req.mentor.programs } };
    const programs = await Program.find(filter).populate('mentors', 'name email').lean();
    const ids = programs.map((p) => p._id);
    const counts = await Mentee.aggregate([
      { $match: { programs: { $in: ids } } },
      { $unwind: '$programs' },
      { $match: { programs: { $in: ids } } },
      { $group: { _id: '$programs', n: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]));
    res.json(
      programs.map((p) => ({
        ...p,
        menteeCount: countMap[p._id.toString()] || 0,
        resourceCount: (p.resources || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/programs', authenticateAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Program name is required' });
    const program = new Program({ name: name.trim(), description });
    await program.save();
    res.status(201).json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/programs/:programId/add-mentor', authenticateAdmin, async (req, res) => {
  try {
    const program = await Program.findById(req.params.programId);
    const mentor = await Mentor.findById(req.body.mentorId);
    if (!program || !mentor) return res.status(404).json({ error: 'Program/Mentor not found' });

    // $addToSet keeps assignment idempotent (old code pushed duplicates)
    await Program.updateOne({ _id: program._id }, { $addToSet: { mentors: mentor._id } });
    await Mentor.updateOne({ _id: mentor._id }, { $addToSet: { programs: program._id } });

    res.json({ message: `${mentor.name} assigned to ${program.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/programs/:programId/remove-mentor', authenticateAdmin, async (req, res) => {
  try {
    await Program.updateOne({ _id: req.params.programId }, { $pull: { mentors: req.body.mentorId } });
    await Mentor.updateOne({ _id: req.body.mentorId }, { $pull: { programs: req.params.programId } });
    res.json({ message: 'Mentor removed from program' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Mentor auth
// ------------------------------------------------------------------ //

router.post('/mentors/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const mentor = await Mentor.findOne({ email: (email || '').toLowerCase().trim() });
    if (!mentor || !(await bcrypt.compare(password || '', mentor.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    res.json({ token: signToken(mentor._id, 'mentor'), mentor: sanitizeMentor(mentor) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mentors/me', authenticate, async (req, res) => {
  const mentor = await Mentor.findById(req.mentor._id).select('-password').populate('programs', 'name');
  res.json(sanitizeMentor(mentor));
});

// ------------------------------------------------------------------ //
// Mentor: resources
// ------------------------------------------------------------------ //

router.post('/resources', authenticate, async (req, res) => {
  try {
    const { title, type, url, deadline, maxScore, program, description, tags, module: moduleId, subtopic } = req.body;
    if (!title || !type || !program) return res.status(400).json({ error: 'Title, type and program are required' });
    if (!['video', 'project'].includes(type)) {
      return res.status(400).json({ error: 'Use /resources/quiz to create quizzes' });
    }
    const programDoc = await Program.findById(program);
    if (!programDoc) return res.status(404).json({ error: 'Program not found' });
    if (!mentorOwnsProgram(req.mentor, program)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }

    const resource = new Resource({
      title, type, url, description, tags, program,
      ...(await placementFor(program, moduleId, subtopic)),
      deadline: deadline || undefined,
      maxScore: maxScore !== undefined && maxScore !== '' ? Number(maxScore) : undefined,
      addedBy: req.mentor._id,
    });
    await resource.save();
    await Program.updateOne({ _id: program }, { $addToSet: { resources: resource._id } });
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resources/quiz', authenticate, async (req, res) => {
  try {
    const { title, program, questions, startTime, endTime, revealScores, description, tags, module: moduleId, subtopic } = req.body;
    if (!title || !program) return res.status(400).json({ error: 'Title and program are required' });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Add at least one question' });
    }
    const programDoc = await Program.findById(program);
    if (!programDoc) return res.status(404).json({ error: 'Program not found' });
    if (!mentorOwnsProgram(req.mentor, program)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }

    const cleanQuestions = questions.map((q) => ({
      questionText: q.questionText,
      options: (q.options || []).filter((o) => o !== ''),
      correctOptionIndex: Number(q.correctOptionIndex) || 0,
      marks: Number(q.marks) || 1,
    }));
    const maxScore = cleanQuestions.reduce((s, q) => s + q.marks, 0);

    // Previously quizzes were created with isLocked: true and nothing ever
    // unlocked them. Availability is now governed by the start/end window.
    const resource = new Resource({
      title, description, tags, program, maxScore,
      ...(await placementFor(program, moduleId, subtopic)),
      type: 'quiz',
      isLocked: false,
      addedBy: req.mentor._id,
      deadline: endTime || undefined,
    });
    await resource.save();

    const quiz = new Quiz({
      resource: resource._id,
      questions: cleanQuestions,
      startTime: startTime || new Date(),
      endTime: endTime || resource.deadline,
      revealScores: !!revealScores,
    });
    await quiz.save();

    resource.quiz = quiz._id;
    await resource.save();
    await Program.updateOne({ _id: program }, { $addToSet: { resources: resource._id } });

    res.status(201).json({ message: 'Quiz resource created', resource, quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/resources/:id', authenticate, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (!mentorOwnsProgram(req.mentor, resource.program)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }
    ['title', 'url', 'description', 'deadline', 'maxScore', 'isLocked', 'tags'].forEach((k) => {
      if (req.body[k] !== undefined) resource[k] = req.body[k];
    });
    await resource.save();
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/resources/:id', authenticate, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (!mentorOwnsProgram(req.mentor, resource.program)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }
    await Program.updateOne({ _id: resource.program }, { $pull: { resources: resource._id } });
    await Quiz.deleteMany({ resource: resource._id });
    await QuizSubmission.deleteMany({ resource: resource._id });
    await Mentee.updateMany({}, { $pull: { completedResources: { resource: resource._id } } });
    await resource.deleteOne();
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Mentor: mentees
// ------------------------------------------------------------------ //

async function nextEnrollmentNumber(program) {
  const prefix = 'TN-' + (program.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'PRG');
  const count = await Mentee.countDocuments({ enrollmentNumber: new RegExp('^' + prefix + '-') });
  let n = count + 1;
  // guard against gaps / collisions
  // eslint-disable-next-line no-await-in-loop
  while (await Mentee.exists({ enrollmentNumber: `${prefix}-${String(n).padStart(4, '0')}` })) n += 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

router.post('/mentees', authenticate, async (req, res) => {
  try {
    const { email, name, programId, interests } = req.body;
    let { enrollmentNumber } = req.body;
    if (!email || !name || !programId) {
      return res.status(400).json({ error: 'Name, email and program are required' });
    }
    const program = await Program.findById(programId);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    if (!mentorOwnsProgram(req.mentor, programId)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }

    enrollmentNumber = (enrollmentNumber || '').trim() || (await nextEnrollmentNumber(program));
    if (await Mentee.exists({ enrollmentNumber })) {
      return res.status(409).json({ error: 'Enrollment number already in use' });
    }

    const tempPassword = generatePassword();
    const mentee = new Mentee({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      enrollmentNumber,
      password: await bcrypt.hash(tempPassword, 10),
      programs: [programId],
      interests: Array.isArray(interests) ? interests : [],
      createdBy: req.mentor._id,
    });
    await mentee.save();

    const out = mentee.toObject();
    delete out.password;
    // tempPassword is returned only here — it is never stored in plain text.
    res.status(201).json({ mentee: out, enrollmentNumber, tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset a mentee's password (mentor forgot to copy it)
router.post('/mentees/:menteeId/reset-password', authenticate, async (req, res) => {
  try {
    const mentee = await Mentee.findById(req.params.menteeId);
    if (!mentee) return res.status(404).json({ error: 'Mentee not found' });
    if (!mentee.programs.some((p) => mentorOwnsProgram(req.mentor, p))) {
      return res.status(403).json({ error: 'Not authorized for this mentee' });
    }
    const tempPassword = generatePassword();
    mentee.password = await bcrypt.hash(tempPassword, 10);
    await mentee.save();
    res.json({ enrollmentNumber: mentee.enrollmentNumber, tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Modules → sub-topics → missions
// ------------------------------------------------------------------ //

// Validates a (module, subtopic) pair for a program; returns fields for the Resource.
async function placementFor(programId, moduleId, subtopicId) {
  if (!moduleId) return {};
  const mod = await Module.findOne({ _id: moduleId, program: programId });
  if (!mod) return {};
  const sub = subtopicId ? mod.subtopics.id(subtopicId) : null;
  return { module: mod._id, subtopic: sub ? sub._id : undefined };
}

async function ownedModule(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.moduleId)) { res.status(404).json({ error: 'Module not found' }); return null; }
  const mod = await Module.findById(req.params.moduleId);
  if (!mod) { res.status(404).json({ error: 'Module not found' }); return null; }
  if (!mentorOwnsProgram(req.mentor, mod.program)) { res.status(403).json({ error: 'Not authorized for this program' }); return null; }
  return mod;
}

const cleanSub = (b = {}) => ({
  title: String(b.title || '').trim().slice(0, 120),
  description: b.description ? String(b.description).slice(0, 400) : undefined,
  lockUntilPrevious: !!b.lockUntilPrevious,
});

// Latest weekly report (written by the "weeklyCohortReport" Render Workflow task).
router.get('/programs/:programId/report', authenticateStaff, async (req, res) => {
  try {
    if (!mentorOwnsProgram(req.mentor, req.params.programId)) return res.status(403).json({ error: 'Not authorized for this program' });
    const report = await CohortReport.findOne({ program: req.params.programId }).sort({ createdAt: -1 }).lean();
    res.json(report || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/programs/:programId/modules', authenticateStaff, async (req, res) => {
  try {
    if (!mentorOwnsProgram(req.mentor, req.params.programId)) return res.status(403).json({ error: 'Not authorized for this program' });
    const [modules, resources] = await Promise.all([
      Module.find({ program: req.params.programId }).sort({ order: 1, createdAt: 1 }).lean(),
      Resource.find({ program: req.params.programId }).select('title type deadline maxScore module subtopic').lean(),
    ]);
    const byKey = {};
    resources.forEach((r) => {
      const k = r.module ? `${r.module}:${r.subtopic || ''}` : 'none';
      (byKey[k] = byKey[k] || []).push(r);
    });
    res.json({
      modules: modules.map((m) => ({
        ...m,
        subtopics: [...m.subtopics].sort((a, b) => a.order - b.order).map((st) => ({ ...st, resources: byKey[`${m._id}:${st._id}`] || [] })),
        looseResources: byKey[`${m._id}:`] || [],
      })),
      unplaced: byKey.none || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/programs/:programId/modules', authenticate, async (req, res) => {
  try {
    if (!mentorOwnsProgram(req.mentor, req.params.programId)) return res.status(403).json({ error: 'Not authorized for this program' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Module title is required' });
    const count = await Module.countDocuments({ program: req.params.programId });
    const subs = (Array.isArray(req.body.subtopics) ? req.body.subtopics : []).map(cleanSub).filter((x) => x.title)
      .map((x, i) => ({ ...x, order: i }));
    const mod = await Module.create({
      program: req.params.programId, title: title.slice(0, 120),
      description: req.body.description ? String(req.body.description).slice(0, 400) : undefined,
      order: count, subtopics: subs,
    });
    res.status(201).json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/modules/:moduleId', authenticate, async (req, res) => {
  try {
    const mod = await ownedModule(req, res);
    if (!mod) return;
    if (req.body.title !== undefined) mod.title = String(req.body.title).trim().slice(0, 120) || mod.title;
    if (req.body.description !== undefined) mod.description = String(req.body.description).slice(0, 400);
    if (req.body.order !== undefined) mod.order = Number(req.body.order) || 0;
    await mod.save();
    res.json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/modules/:moduleId', authenticate, async (req, res) => {
  try {
    const mod = await ownedModule(req, res);
    if (!mod) return;
    await Resource.updateMany({ module: mod._id }, { $unset: { module: 1, subtopic: 1 } });
    await mod.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder modules: { order: [moduleId, ...] }
router.put('/programs/:programId/modules/order', authenticate, async (req, res) => {
  try {
    if (!mentorOwnsProgram(req.mentor, req.params.programId)) return res.status(403).json({ error: 'Not authorized for this program' });
    const ids = (req.body?.order || []).filter((x) => /^[a-f0-9]{24}$/i.test(x));
    await Promise.all(ids.map((id, i) => Module.updateOne({ _id: id, program: req.params.programId }, { $set: { order: i } })));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/modules/:moduleId/subtopics', authenticate, async (req, res) => {
  try {
    const mod = await ownedModule(req, res);
    if (!mod) return;
    const sub = cleanSub(req.body);
    if (!sub.title) return res.status(400).json({ error: 'Sub-topic title is required' });
    mod.subtopics.push({ ...sub, order: mod.subtopics.length });
    await mod.save();
    res.status(201).json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/modules/:moduleId/subtopics/:subId', authenticate, async (req, res) => {
  try {
    const mod = await ownedModule(req, res);
    if (!mod) return;
    const sub = mod.subtopics.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Sub-topic not found' });
    if (req.body.title !== undefined) sub.title = String(req.body.title).trim().slice(0, 120) || sub.title;
    if (req.body.description !== undefined) sub.description = String(req.body.description).slice(0, 400);
    if (req.body.lockUntilPrevious !== undefined) sub.lockUntilPrevious = !!req.body.lockUntilPrevious;
    if (req.body.move === 'up' || req.body.move === 'down') {
      const list = [...mod.subtopics].sort((a, b) => a.order - b.order);
      const i = list.findIndex((x) => String(x._id) === String(sub._id));
      const j = req.body.move === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < list.length) { const t = list[i].order; list[i].order = list[j].order; list[j].order = t; }
      list.forEach((x, k) => { x.order = k; });
    }
    await mod.save();
    res.json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/modules/:moduleId/subtopics/:subId', authenticate, async (req, res) => {
  try {
    const mod = await ownedModule(req, res);
    if (!mod) return;
    const sub = mod.subtopics.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Sub-topic not found' });
    await Resource.updateMany({ module: mod._id, subtopic: sub._id }, { $unset: { subtopic: 1 } });
    sub.deleteOne();
    await mod.save();
    res.json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Move a mission into a module/sub-topic (or out: module = null)
router.put('/resources/:resourceId/placement', authenticate, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.resourceId)) return res.status(404).json({ error: 'Resource not found' });
    const r = await Resource.findById(req.params.resourceId);
    if (!r) return res.status(404).json({ error: 'Resource not found' });
    if (!mentorOwnsProgram(req.mentor, r.program)) return res.status(403).json({ error: 'Not authorized for this program' });
    const place = await placementFor(r.program, req.body?.module, req.body?.subtopic);
    if (req.body?.module && !place.module) return res.status(400).json({ error: 'Module not found in this program' });
    r.module = place.module; r.subtopic = place.subtopic;
    await r.save();
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Mentor: a mentee's AI card + endorsement
// ------------------------------------------------------------------ //

async function mentorsMentee(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.menteeId)) { res.status(404).json({ error: 'Mentee not found' }); return null; }
  const mentee = await Mentee.findById(req.params.menteeId).select('programs');
  if (!mentee) { res.status(404).json({ error: 'Mentee not found' }); return null; }
  if (!mentee.programs.some((p) => mentorOwnsProgram(req.mentor, p))) {
    res.status(403).json({ error: 'Not authorized for this mentee' });
    return null;
  }
  return mentee;
}

router.get('/mentees/:menteeId/card', authenticate, async (req, res) => {
  try {
    if (!(await mentorsMentee(req, res))) return;
    res.json(await buildCard(req.params.menteeId, { mode: 'mentor' }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/mentees/:menteeId/endorse', authenticate, async (req, res) => {
  try {
    if (!(await mentorsMentee(req, res))) return;
    const text = String(req.body?.text || '').trim().slice(0, 220);
    const update = text
      ? { $set: { endorsement: { text, mentor: req.mentor._id, mentorName: req.mentor.name, at: new Date() } } }
      : { $unset: { endorsement: 1 } };
    await Mentee.updateOne({ _id: req.params.menteeId }, update);
    res.json({ endorsement: text ? { text, mentorName: req.mentor.name, at: new Date() } : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------ //
// Mentor: project review
// ------------------------------------------------------------------ //

router.patch('/:menteeId/resources/:resourceId/verify', authenticate, async (req, res) => {
  try {
    const { menteeId, resourceId } = req.params;
    const score = Number(req.body.score);
    if (Number.isNaN(score) || score < 0) return res.status(400).json({ error: 'Enter a valid score' });

    const resource = await Resource.findById(resourceId);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (resource.type !== 'project') {
      return res.status(400).json({ error: 'Only project-type resources can be verified' });
    }
    if (!mentorOwnsProgram(req.mentor, resource.program)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }

    const mentee = await Mentee.findById(menteeId);
    if (!mentee) return res.status(404).json({ error: 'Mentee not found' });

    const submission = mentee.completedResources.find((e) => e.resource.toString() === resourceId);
    if (!submission) return res.status(400).json({ error: 'Project not yet submitted by this mentee' });
    if (submission.verified) return res.status(400).json({ error: 'This project has already been verified' });

    // Apply the same late penalty used for videos (1 pt / day late)
    const late = resource.deadline && submission.submittedOn > resource.deadline
      ? Math.floor((submission.submittedOn - resource.deadline) / 86400000)
      : 0;
    const finalScore = Math.max(0, Math.min(score, resource.maxScore) - late);
    submission.score = finalScore;
    submission.verified = true;
    submission.feedback = req.body.feedback;
    // totalScore is derived from completedResources everywhere; the old
    // `mentee.totalScore += finalScore` double-counted and has been removed.
    await mentee.save();

    res.json({ message: 'Project verified and scored', finalScore, latePenalty: late });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/unverified-projects', authenticate, async (req, res) => {
  try {
    const mentor = req.mentor;
    const mentees = await Mentee.find({
      programs: { $in: mentor.programs },
      'completedResources.verified': false,
    }).populate('completedResources.resource');

    const unverifiedProjects = [];
    mentees.forEach((mentee) => {
      mentee.completedResources.forEach((entry) => {
        const r = entry.resource;
        if (r && r.type === 'project' && entry.verified === false && mentorOwnsProgram(mentor, r.program)) {
          unverifiedProjects.push({
            menteeId: mentee._id,
            menteeName: mentee.name,
            enrollmentNumber: mentee.enrollmentNumber,
            resourceId: r._id,
            resourceTitle: r.title,
            maxScore: r.maxScore,
            deadline: r.deadline,
            githubLink: entry.githubLink,
            deployedLink: entry.deployedLink,
            description: entry.description,
            submittedOn: entry.submittedOn,
          });
        }
      });
    });
    unverifiedProjects.sort((a, b) => new Date(a.submittedOn) - new Date(b.submittedOn));
    res.json({ unverifiedProjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------------------------------------------ //
// Mentor: program data (now authenticated + scoped, no passwords leaked)
// ------------------------------------------------------------------ //

router.get('/:programId/mentees', authenticateStaff, async (req, res) => {
  try {
    if (req.mentor && !mentorOwnsProgram(req.mentor, req.params.programId)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }
    const resources = await Resource.find({ program: req.params.programId }).select('_id maxScore').lean();
    const resourceIds = new Set(resources.map((r) => r._id.toString()));
    const maxTotal = resources.reduce((s, r) => s + (r.maxScore || 0), 0);

    const mentees = await Mentee.find({ programs: req.params.programId })
      .select('-password -aiProfile')
      .populate('completedResources.resource', 'title type program')
      .lean();

    res.json(
      mentees.map((m) => {
        const inProgram = (m.completedResources || []).filter(
          (c) => c.resource && resourceIds.has(c.resource._id.toString())
        );
        const score = inProgram.reduce((s, c) => s + (c.score || 0), 0);
        return {
          ...m,
          programScore: score,
          completedCount: inProgram.length,
          totalResources: resources.length,
          progress: resources.length ? Math.round((inProgram.length / resources.length) * 100) : 0,
          scorePct: maxTotal ? Math.round((score / maxTotal) * 100) : 0,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:programId/resources', authenticateStaff, async (req, res) => {
  try {
    if (req.mentor && !mentorOwnsProgram(req.mentor, req.params.programId)) {
      return res.status(403).json({ error: 'Not authorized for this program' });
    }
    const [resources, menteeCount] = await Promise.all([
      Resource.find({ program: req.params.programId }).sort({ createdAt: -1 }).lean(),
      Mentee.countDocuments({ programs: req.params.programId }),
    ]);
    const ids = resources.map((r) => r._id);
    const done = await Mentee.aggregate([
      { $match: { programs: { $exists: true } } },
      { $unwind: '$completedResources' },
      { $match: { 'completedResources.resource': { $in: ids } } },
      { $group: { _id: '$completedResources.resource', n: { $sum: 1 } } },
    ]);
    const doneMap = Object.fromEntries(done.map((d) => [d._id.toString(), d.n]));
    res.json(
      resources.map((r) => ({
        ...r,
        completions: doneMap[r._id.toString()] || 0,
        completionRate: menteeCount ? Math.round(((doneMap[r._id.toString()] || 0) / menteeCount) * 100) : 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
