// Shared mentee state: resource statuses, aggregate stats and leaderboard rank.
// Used by the mentee routes, the AI card builder and the mentor card view.
const Mentee = require('../models/Mentee');
const Quiz = require('../models/Quiz');
const Module = require('../models/Module');

const DAY = 86400000;

async function loadMenteeState(menteeId) {
  const mentee = await Mentee.findById(menteeId)
    .select('-password')
    .populate({ path: 'programs', populate: { path: 'resources', model: 'Resource' } });

  const allResources = mentee.programs.flatMap((p) => p.resources || []);
  const quizzes = await Quiz.find({ resource: { $in: allResources.map((r) => r._id) } })
    .select('resource startTime endTime questions')
    .lean();
  const quizMap = new Map(quizzes.map((q) => [q.resource.toString(), q]));

  const completedMap = new Map();
  mentee.completedResources.forEach((c) => {
    if (c.resource) completedMap.set(c.resource.toString(), c);
  });

  const now = Date.now();
  let totalScore = 0;
  mentee.completedResources.forEach((c) => { totalScore += c.score || 0; });

  const programs = mentee.programs.map((program) => {
    const resources = (program.resources || []).map((r) => {
      const c = completedMap.get(r._id.toString());
      const q = quizMap.get(r._id.toString());
      const opensAt = q?.startTime || null;
      const closesAt = q?.endTime || r.deadline || null;

      let status;
      if (c && r.type === 'project' && !c.verified) status = 'pending_review';
      else if (c) status = 'completed';
      else if (r.isLocked) status = 'locked';
      else if (r.type === 'quiz' && opensAt && now < new Date(opensAt).getTime()) status = 'upcoming';
      else if (r.type === 'quiz' && closesAt && now > new Date(closesAt).getTime()) status = 'closed';
      else if (r.deadline && now > new Date(r.deadline).getTime()) status = 'overdue';
      else status = 'available';

      return {
        ...r.toObject(),
        status,
        completed: !!c,
        score: c ? c.score : null,
        completedOn: c ? c.completedOn || c.submittedOn : null,
        verified: c ? c.verified : null,
        feedback: c?.feedback || null,
        questionCount: q ? q.questions.length : undefined,
        opensAt,
        closesAt,
      };
    });
    return { _id: program._id, name: program.name, description: program.description, resources };
  });

  await attachModules(programs);
  return { mentee, programs, totalScore };
}

async function buildStats(menteeId) {
  const { mentee, programs, totalScore } = await loadMenteeState(menteeId);
  const resources = programs.flatMap((p) => p.resources);
  const byType = {};
  ['video', 'quiz', 'project'].forEach((t) => {
    const all = resources.filter((r) => r.type === t);
    const done = all.filter((r) => r.status === 'completed');
    const pctScores = done.filter((r) => r.maxScore).map((r) => (r.score / r.maxScore) * 100);
    byType[t] = {
      total: all.length,
      done: done.length,
      avgPct: pctScores.length ? Math.round(pctScores.reduce((a, b) => a + b, 0) / pctScores.length) : null,
    };
  });

  const finished = resources.filter((r) => r.completed && r.completedOn);
  const onTime = finished.filter((r) => !r.deadline || new Date(r.completedOn) <= new Date(r.deadline));
  const earned = resources.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.score || 0), 0);
  const possible = resources.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.maxScore || 0), 0);
  const now = Date.now();
  const pending = resources
    .filter((r) => ['available', 'overdue'].includes(r.status))
    .map((r) => ({
      id: r._id.toString(),
      title: r.title,
      type: r.type,
      maxScore: r.maxScore,
      daysLeft: r.deadline ? Math.ceil((new Date(r.deadline).getTime() - now) / DAY) : null,
      tags: r.tags || [],
    }))
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
    .slice(0, 6);

  // Cumulative score timeline for charts
  let running = 0;
  const timeline = mentee.completedResources
    .filter((c) => c.completedOn || c.submittedOn)
    .sort((a, b) => new Date(a.completedOn || a.submittedOn) - new Date(b.completedOn || b.submittedOn))
    .map((c) => {
      running += c.score || 0;
      return { date: c.completedOn || c.submittedOn, score: c.score || 0, cumulative: running };
    });

  const totalMentees = await Mentee.countDocuments();
  const rank = await calculateRank(mentee._id);

  const stats = {
      name: mentee.name,
      programs: programs.map((p) => p.name),
      interests: mentee.interests || [],
      totalScore,
      rank,
      totalMentees,
      percentile: rank && totalMentees ? Math.max(1, Math.round((rank / totalMentees) * 100)) : null,
      streak: mentee.streak || 0,
      completed: finished.length,
      totalResources: resources.length,
      pendingReview: resources.filter((r) => r.status === 'pending_review').length,
      byType,
      avgScorePct: possible ? Math.round((earned / possible) * 100) : 0,
      onTimeRate: finished.length ? Math.round((onTime.length / finished.length) * 100) : 100,
      pending,
  };
  Object.assign(stats, computeFacts(stats, resources, mentee));
  return { mentee, programs, timeline, resources, stats };
}

async function calculateRank(menteeId) {
  const me = await Mentee.findById(menteeId).select('streak lastActiveDate completedResources.score').lean();
  if (!me) return null;
  const myScore = (me.completedResources || []).reduce((s, c) => s + (c?.score || 0), 0);
  const myStreak = me.streak || 0;
  const myLast = me.lastActiveDate || new Date(0);

  const better = await Mentee.aggregate([
    {
      $project: {
        streak: { $ifNull: ['$streak', 0] },
        lastActiveDate: { $ifNull: ['$lastActiveDate', new Date(0)] },
        totalScore: { $sum: { $map: { input: { $ifNull: ['$completedResources', []] }, as: 'cr', in: { $ifNull: ['$$cr.score', 0] } } } },
      },
    },
    {
      $match: {
        $or: [
          { totalScore: { $gt: myScore } },
          { totalScore: myScore, streak: { $gt: myStreak } },
          { totalScore: myScore, streak: myStreak, lastActiveDate: { $gt: myLast } },
        ],
      },
    },
    { $count: 'cnt' },
  ]);
  return (better[0]?.cnt || 0) + 1;
}

// Short, checkable evidence phrases. The AI may only highlight these, so every
// highlighted claim on the card maps back to real activity.
function computeFacts(stats, resources, mentee) {
  const list = [];
  const add = (key, text) => list.push({ key, text });
  const done = resources.filter((r) => r.status === 'completed' && r.completedOn);
  const quizzes = done.filter((r) => r.type === 'quiz');
  const quizOnTime = quizzes.filter((r) => !r.closesAt || new Date(r.completedOn) <= new Date(r.closesAt)).length;
  if (quizzes.length) add('quizOnTime', `${quizOnTime}/${quizzes.length} quizzes on time`);
  if (stats.streak >= 2) add('streak', `${stats.streak}-day streak`);
  if (stats.byType.video.done) add('videos', `${stats.byType.video.done} video${stats.byType.video.done > 1 ? 's' : ''}`);
  if (stats.byType.quiz.avgPct !== null) add('quizAvg', `${stats.byType.quiz.avgPct}% quiz avg`);
  if (stats.byType.project.total) {
    const sub = resources.filter((r) => r.type === 'project' && r.completed).length;
    add('projects', `${sub} of ${stats.byType.project.total} projects`);
  }
  if (stats.completed) add('done', `${stats.completed} of ${stats.totalResources} missions`);
  if (stats.rank) add('rank', `rank #${stats.rank} of ${stats.totalMentees}`);
  add('points', `${stats.totalScore.toLocaleString('en-IN')} points`);

  // Strongest track = tag with the most completions
  const tagCount = {};
  done.forEach((r) => (r.tags || []).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) add('topTrack', `strongest in ${top[0]}`);

  // Rhythm from completion times (IST)
  const hours = (mentee.completedResources || [])
    .map((c) => c.completedOn || c.submittedOn).filter(Boolean)
    .map((d) => (new Date(d).getUTCHours() + 5.5) % 24);
  let rhythm = 'mixed';
  if (hours.length >= 3) {
    const night = hours.filter((h) => h >= 21 || h < 4).length / hours.length;
    const morning = hours.filter((h) => h >= 5 && h < 10).length / hours.length;
    if (night >= 0.5) { rhythm = 'night'; add('rhythm', 'mostly after 9 pm'); }
    else if (morning >= 0.5) { rhythm = 'morning'; add('rhythm', 'mostly before 10 am'); }
  }
  return { factList: list, facts: list.map((f) => f.text), rhythm, topTag: top ? top[0] : null };
}

// Builds program.modules (Module → sub-topics → resource ids) and applies
// "lock until previous sub-topic is complete" to resource statuses.
async function attachModules(programs) {
  if (!programs.length) return;
  const modules = await Module.find({ program: { $in: programs.map((p) => p._id) } }).sort({ order: 1, createdAt: 1 }).lean();
  const finished = (r) => r.status === 'completed' || r.status === 'pending_review';
  for (const program of programs) {
    const mods = modules.filter((m) => String(m.program) === String(program._id));
    const byId = new Map(program.resources.map((r) => [String(r._id), r]));
    const placed = new Set();
    let prevDone = true;
    let currentFound = false;
    program.modules = mods.map((m) => {
      const subs = [...m.subtopics].sort((a, b) => a.order - b.order).map((st) => {
        const res = program.resources.filter((r) => String(r.module || '') === String(m._id) && String(r.subtopic || '') === String(st._id));
        res.forEach((r) => placed.add(String(r._id)));
        const done = res.length > 0 && res.every(finished);
        const locked = st.lockUntilPrevious && !prevDone && !done;
        if (locked) res.forEach((r) => { if (!finished(r)) { r.status = 'locked'; r.lockedReason = 'previous_subtopic'; } });
        let state = done ? 'done' : locked ? 'locked' : 'open';
        if (state === 'open' && !currentFound && res.length) { state = 'current'; currentFound = true; }
        if (res.length) prevDone = done;
        return {
          _id: st._id, title: st.title, description: st.description || '', state,
          lockUntilPrevious: !!st.lockUntilPrevious,
          references: (st.references || []).map((x) => ({ _id: x._id, title: x.title, url: x.url, channel: x.channel || '', minutes: x.minutes || null })),
          resourceIds: res.map((r) => String(r._id)),
          done: res.filter(finished).length, total: res.length,
        };
      });
      const loose = program.resources.filter((r) => String(r.module || '') === String(m._id) && !r.subtopic);
      loose.forEach((r) => placed.add(String(r._id)));
      const all = subs.flatMap((x) => x.resourceIds).concat(loose.map((r) => String(r._id)));
      const doneN = all.filter((id) => finished(byId.get(id))).length;
      return {
        _id: m._id, title: m.title, description: m.description || '', order: m.order,
        startsAt: m.startsAt || null, endsAt: m.endsAt || null,
        subtopics: subs, looseResourceIds: loose.map((r) => String(r._id)),
        done: doneN, total: all.length, pct: all.length ? Math.round((doneN / all.length) * 100) : 0,
      };
    });
    program.unplacedResourceIds = program.resources.filter((r) => !placed.has(String(r._id))).map((r) => String(r._id));
  }
}

module.exports = { attachModules, loadMenteeState, buildStats, calculateRank, computeFacts, DAY };
