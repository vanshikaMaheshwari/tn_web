// AI card v2: everything the profile page shows, in one payload.
// The AI writes the words (archetype, headline, summary, badges, reasons);
// every number on the card is computed here from real activity, so the two
// can be checked against each other.
const Mentee = require('../models/Mentee');
const { buildStats, DAY } = require('./menteeState');
const { generateProfile, generateWithRules, verifyEvidence } = require('./aiProfile');
const pipeline = require('./aiPipeline');

const SKILLS = ['videos', 'quizzes', 'projects', 'consistency', 'punctuality'];
const TYPE_SKILL = { video: 'videos', quiz: 'quizzes', project: 'projects' };
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const OPEN = new Set(['available', 'overdue']);

// ------------------------------------------------------------------ //
// Skills: one formula for the learner, the cohort and "what-if" previews
// ------------------------------------------------------------------ //

// rows: [{ id, type, maxScore, closesAt, status, completedOn, score }]
// status: completed | pending_review | available | overdue | closed | upcoming | locked
function skillVector(rows, streak, { asOf = Date.now(), extra = null } = {}) {
  const counted = rows.filter((r) => !['upcoming', 'locked'].includes(r.status));
  const isDone = (r) =>
    (r.id === extra) ||
    (r.status === 'completed' && r.completedOn && new Date(r.completedOn).getTime() <= asOf);
  const scoreOf = (r) => (r.id === extra ? r.maxScore || 0 : r.score || 0);

  const ofType = (t) => counted.filter((r) => r.type === t);
  const videos = ofType('video');
  const coverage = (list) => {
    const max = list.reduce((s, r) => s + (r.maxScore || 0), 0);
    const got = list.filter(isDone).reduce((s, r) => s + scoreOf(r), 0);
    return max ? (got / max) * 100 : 0;
  };

  const doneDates = rows.filter(isDone).map((r) => (r.id === extra ? asOf : new Date(r.completedOn).getTime()));
  const activeDays = new Set(doneDates.filter((t) => t > asOf - 14 * DAY).map((t) => new Date(t).toDateString())).size;
  const finished = rows.filter((r) => isDone(r) && r.closesAt);
  const onTime = finished.filter((r) => r.id === extra || new Date(r.completedOn) <= new Date(r.closesAt));

  return {
    videos: clamp(videos.length ? (videos.filter(isDone).length / videos.length) * 100 : 0),
    quizzes: clamp(coverage(ofType('quiz'))),
    projects: clamp(coverage(ofType('project'))),
    consistency: clamp(Math.max(streak * 8, (activeDays / 10) * 100)),
    punctuality: clamp(finished.length ? (onTime.length / finished.length) * 100 : 100),
  };
}

const toRows = (resources) =>
  resources.map((r) => ({
    id: String(r._id),
    type: r.type,
    title: r.title,
    tags: r.tags || [],
    maxScore: r.maxScore || 0,
    closesAt: r.closesAt || r.deadline || null,
    status: r.status,
    completedOn: r.completedOn,
    score: r.score,
  }));

// Cohort average: same resources, each peer's own completions.
async function cohortAverage(menteeId, programId, rows) {
  if (!programId) return null;
  const peers = await Mentee.find({ programs: programId, _id: { $ne: menteeId } })
    .select('completedResources streak').limit(200).lean();
  if (!peers.length) return null;
  const sum = Object.fromEntries(SKILLS.map((k) => [k, 0]));
  peers.forEach((p) => {
    const map = new Map((p.completedResources || []).filter((c) => c.resource).map((c) => [String(c.resource), c]));
    const peerRows = rows.map((r) => {
      const c = map.get(r.id);
      if (!c) return { ...r, status: OPEN.has(r.status) || ['completed', 'pending_review'].includes(r.status) ? 'available' : r.status, completedOn: null, score: 0 };
      const verified = r.type !== 'project' || c.verified;
      return { ...r, status: verified ? 'completed' : 'pending_review', completedOn: c.completedOn || c.submittedOn, score: c.score || 0 };
    });
    const v = skillVector(peerRows, p.streak || 0);
    SKILLS.forEach((k) => { sum[k] += v[k]; });
  });
  return Object.fromEntries(SKILLS.map((k) => [k, Math.round(sum[k] / peers.length)]));
}

// ------------------------------------------------------------------ //
// Leaderboard + rank forecast
// ------------------------------------------------------------------ //

async function leaderboard() {
  return Mentee.aggregate([
    {
      $project: {
        name: 1,
        streak: { $ifNull: ['$streak', 0] },
        lastActiveDate: { $ifNull: ['$lastActiveDate', new Date(0)] },
        totalScore: { $sum: { $map: { input: { $ifNull: ['$completedResources', []] }, as: 'cr', in: { $ifNull: ['$$cr.score', 0] } } } },
      },
    },
    { $sort: { totalScore: -1, streak: -1, lastActiveDate: -1, _id: 1 } },
  ]);
}

function forecast(board, menteeId, missions) {
  const idx = board.findIndex((m) => String(m._id) === String(menteeId));
  if (idx < 0) return null;
  const me = board[idx];
  const others = board.filter((_, i) => i !== idx);
  const rankFor = (score) => 1 + others.filter((o) => o.totalScore > score).length;

  const steps = [];
  let score = me.totalScore;
  for (const m of missions.filter((x) => x.points > 0)) {
    if (rankFor(score) === 1 || steps.length >= 3) break;
    score += m.points;
    steps.push({ resourceId: m.id, title: m.title, type: m.type, points: m.points, score, rank: rankFor(score) });
  }
  const finalRank = steps.length ? steps[steps.length - 1].rank : idx + 1;
  const passed = others
    .filter((o) => o.totalScore >= me.totalScore && o.totalScore < score)
    .sort((a, b) => b.totalScore - a.totalScore)[0];
  const above = idx > 0 ? board[idx - 1] : null;
  return {
    rank: idx + 1,
    total: board.length,
    score: me.totalScore,
    steps,
    finalRank,
    finalScore: score,
    passes: passed ? { name: passed.name.split(' ')[0], score: passed.totalScore } : null,
    gapToNext: above ? Math.max(0, above.totalScore - me.totalScore + 1) : 0,
    nextName: above ? above.name.split(' ')[0] : null,
  };
}

// ------------------------------------------------------------------ //
// Pieces
// ------------------------------------------------------------------ //

function levelInfo(score) {
  const level = Math.min(50, 1 + Math.floor(Math.sqrt(Math.max(0, score) / 20)));
  const floor = 20 * (level - 1) ** 2;
  const next = 20 * level ** 2;
  return { level, progress: clamp(((score - floor) / (next - floor)) * 100), nextAt: next };
}

function rarity(rank, total) {
  if (!rank || !total) return 'common';
  const pct = rank / total;
  if (pct <= 0.1) return 'legendary';
  if (pct <= 0.25) return 'epic';
  if (pct <= 0.5) return 'rare';
  return 'common';
}

const CATS = [
  ['web', /react|next|web|front|html|css|javascript|\bjs\b|tailwind/],
  ['dsa', /dsa|algo|data struct|leetcode|\bcp\b|competitive|c\+\+|java\b/],
  ['design', /design|ui|ux|figma/],
  ['ai', /\bai\b|ml|machine|data|python|deep|llm/],
  ['backend', /back|node|express|api|database|mongo|sql/],
  ['app', /app|android|flutter|kotlin|ios|mobile/],
  ['cloud', /cloud|devops|docker|aws|linux/],
];
const catOf = (t) => (CATS.find(([, re]) => re.test(String(t).toLowerCase())) || ['spark'])[0];

// Avatar traits are generated from interests, strongest skill, level and streak;
// the frontend draws them as an SVG robot, so every learner looks different.
function avatarTraits({ interests, topTag, skills, level, streak, name }) {
  const sources = [...new Set([...(interests || []), topTag].filter(Boolean))];
  const cats = [...new Set(sources.map(catOf))].filter((c) => c !== 'spark');
  const strongest = Object.entries(skills).sort((a, b) => b[1] - a[1])[0][0];
  const hash = [...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const accessories = [];
  if (level >= 5) accessories.push('headset');
  if (level >= 10) accessories.push('jetpack');
  if (streak >= 7) accessories.push('flame');
  return {
    antenna: cats[0] || 'spark',
    chest: cats[1] || cats[0] || 'spark',
    visor: { videos: 'cyan', quizzes: 'yellow', projects: 'green', consistency: 'pink', punctuality: 'cyan' }[strongest],
    body: ['white', 'sky', 'mint', 'lilac'][hash % 4],
    accessories,
    builtFrom: sources.slice(0, 3),
    nextUnlock: level < 5 ? { level: 5, item: 'headset' } : level < 10 ? { level: 10, item: 'jetpack' } : null,
  };
}

function constellation(rows, interests, recIds) {
  const wanted = (interests || []).map((t) => t.toLowerCase());
  const keyOf = (r) => r.tags.find((t) => wanted.includes(t)) || r.tags[0] || r.type;
  const groups = new Map();
  rows.forEach((r) => {
    const k = keyOf(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });
  const stateOf = (r) => {
    if (r.status === 'completed') return 'done';
    if (r.status === 'pending_review') return 'review';
    if (recIds.has(r.id)) return 'next';
    if (OPEN.has(r.status)) return 'open';
    if (r.status === 'closed') return 'missed';
    return 'lock';
  };
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([key, list]) => {
      const nodes = list.slice(0, 7).map((r) => ({ id: r.id, title: r.title, type: r.type, state: stateOf(r) }));
      return { key, label: key.replace(/[_-]/g, ' '), done: list.filter((r) => r.status === 'completed').length, total: list.length, nodes };
    });
}

function nextMissions(rows, streak, skills, ai) {
  const weakest = Object.entries(skills).sort((a, b) => a[1] - b[1])[0][0];
  const aiWhy = new Map((ai?.recommendations || []).filter((r) => r.resourceId).map((r) => [r.resourceId, r.why]));
  const now = Date.now();
  return rows
    .filter((r) => OPEN.has(r.status))
    .map((r) => {
      const skill = TYPE_SKILL[r.type];
      const after = skillVector(rows, streak, { extra: r.id })[skill];
      const impact = Math.max(0, after - skills[skill]);
      const daysLeft = r.closesAt ? Math.ceil((new Date(r.closesAt).getTime() - now) / DAY) : null;
      const urgency = daysLeft === null ? 0 : daysLeft <= 0 ? 3 : daysLeft <= 2 ? 2 : daysLeft <= 7 ? 1 : 0;
      const weight = impact * (skill === weakest ? 2 : 1) + r.maxScore / 50 + urgency * 5 + (aiWhy.has(r.id) ? 8 : 0);
      let why = aiWhy.get(r.id);
      if (!why) {
        why = skill === weakest
          ? `${skill[0].toUpperCase() + skill.slice(1)} is your weakest skill (${skills[skill]}). This lifts it to ~${after}.`
          : daysLeft !== null && daysLeft <= 2
            ? `Due ${daysLeft <= 0 ? 'now' : `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}. Grab the points before it closes.`
            : `Keeps your ${skill} score climbing toward the cohort lead.`;
      }
      return { id: r.id, title: r.title, type: r.type, points: r.maxScore, skill, impact, daysLeft, why, weight, overdue: r.status === 'overdue' };
    })
    .sort((a, b) => b.weight - a.weight)
    .map(({ weight, ...m }) => m);
}

function badgeShelf(ai, stats, rows, rank) {
  const earned = (ai?.badges || []).slice(0, 5);
  const verifiedProjects = rows.filter((r) => r.type === 'project' && r.status === 'completed').length;
  const doneAll = rows.filter((r) => r.status === 'completed').length;
  const goals = [
    { name: 'Shipper', icon: 'rocket', goal: 'Get 3 projects verified', have: verifiedProjects, need: 3 },
    { name: 'Podium', icon: 'trophy', goal: 'Reach the top 3', have: rank && rank <= 3 ? 1 : 0, need: 1, note: rank ? `you're #${rank}` : null },
    { name: 'Week Warrior', icon: 'flame', goal: 'Hit a 7-day streak', have: Math.min(stats.streak, 7), need: 7 },
    { name: 'Quiz Ace', icon: 'target', goal: 'Average 80%+ on quizzes', have: Math.min(stats.byType.quiz.avgPct || 0, 80), need: 80 },
    { name: 'Completionist', icon: 'star', goal: 'Finish every open mission', have: doneAll, need: Math.max(1, rows.filter((r) => !['upcoming', 'locked'].includes(r.status)).length) },
  ];
  const earnedNames = new Set(earned.map((b) => b.name.toLowerCase()));
  const locked = goals
    .filter((g) => g.have < g.need && !earnedNames.has(g.name.toLowerCase()))
    .map((g) => ({ ...g, progress: clamp((g.have / g.need) * 100) }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);
  return { earned, locked };
}

function journey(timeline, resources) {
  const now = Date.now();
  const weeks = [];
  for (let i = 9; i >= 0; i--) {
    const end = now - i * 7 * DAY;
    const pts = timeline.filter((t) => new Date(t.date).getTime() <= end).reduce((m, t) => Math.max(m, t.cumulative), 0);
    weeks.push({ label: `W${10 - i}`, end: new Date(end), points: pts });
  }
  const start = now - 10 * 7 * DAY;
  const weekOf = (d) => Math.min(9, Math.max(0, Math.floor((new Date(d).getTime() - start) / (7 * DAY))));
  const firsts = {};
  resources
    .filter((r) => r.completed && r.completedOn)
    .sort((a, b) => new Date(a.completedOn) - new Date(b.completedOn))
    .forEach((r) => { if (!firsts[r.type]) firsts[r.type] = r.completedOn; });
  const milestones = [['video', '1st video'], ['quiz', '1st quiz'], ['project', '1st project']]
    .filter(([t]) => firsts[t] && new Date(firsts[t]).getTime() >= start)
    .map(([t, label]) => ({ week: weekOf(firsts[t]), label }));
  const thisWeek = weeks[9].points - weeks[8].points;
  return { weeks: weeks.map(({ end, ...w }) => w), milestones, thisWeek };
}

// ------------------------------------------------------------------ //
// Main
// ------------------------------------------------------------------ //

// mode: 'self' (may call Gemini and save) | 'mentor' | 'public'
async function buildCard(menteeId, { mode = 'self', forceAi = false } = {}) {
  const { mentee, programs, timeline, resources, stats } = await buildStats(menteeId);
  const rows = toRows(resources);

  // AI words (cached for 6h; v1 profiles without an archetype are upgraded).
  // With Render Workflows enabled, generation is queued as a background run that
  // retries on Gemini outages; meanwhile the card shows the cached or rules version.
  let ai = mentee.aiProfile;
  let aiSource = mentee.aiProfileSource || null;
  let aiAt = mentee.aiProfileAt || null;
  let aiModel = mentee.aiProfileModel || ai?.model || null;
  let aiJob = null;
  const stale = !ai || !ai.archetype || (aiAt && Date.now() - new Date(aiAt).getTime() > 6 * 3600 * 1000);

  const generateInline = async () => {
    const r = await generateProfile(stats);
    ai = { ...r.profile, model: r.model }; aiSource = r.source; aiAt = new Date(); aiModel = r.model;
    await Mentee.updateOne({ _id: mentee._id }, { $set: { aiProfile: ai, aiProfileAt: aiAt, aiProfileSource: aiSource, aiProfileModel: aiModel } });
  };

  if (mode === 'self' && pipeline.enabled()) {
    let job = await pipeline.refreshStatus(mentee);
    const lastEnd = job?.finishedAt || job?.queuedAt;
    const recentlyFailed = job?.status === 'failed' && lastEnd && Date.now() - new Date(lastEnd).getTime() < 10 * 60 * 1000;
    const wantsGemini = forceAi || stale || (aiSource !== 'gemini' && !recentlyFailed);
    if (wantsGemini && !pipeline.isActive(job)) {
      try {
        job = await pipeline.queueCard(mentee._id, { force: forceAi });
      } catch (err) {
        console.warn('[aiPipeline] could not queue on Render Workflows, generating inline:', err.message);
        if (forceAi || stale) await generateInline();
      }
    }
    aiJob = pipeline.jobView(job);
  } else if (mode === 'self' && (forceAi || stale)) {
    await generateInline();
  } else if (mode === 'mentor') {
    aiJob = pipeline.jobView(mentee.aiJob);
  }
  if (!ai || !ai.archetype) {
    ai = generateWithRules(stats); aiSource = 'rules'; aiAt = new Date(); aiModel = null;
  }
  // Re-verify evidence against today's facts (numbers may have moved since generation)
  ai = { ...ai, summary: verifyEvidence(ai.summary, stats.facts) };

  const skillsNow = skillVector(rows, stats.streak);
  const weekAgo = skillVector(rows, Math.max(0, stats.streak - 7), { asOf: Date.now() - 7 * DAY });
  const cohort = await cohortAverage(mentee._id, programs[0]?._id, rows);
  const skills = Object.fromEntries(SKILLS.map((k) => [k, { value: skillsNow[k], delta: skillsNow[k] - weekAgo[k], cohort: cohort ? cohort[k] : null }]));

  const missions = nextMissions(rows, stats.streak, skillsNow, ai);
  const recIds = new Set(missions.slice(0, 3).map((m) => m.id));
  const board = await leaderboard();
  const fc = forecast(board, mentee._id, [...missions].sort((a, b) => b.points - a.points));
  const rank = fc?.rank || stats.rank;
  const lvl = levelInfo(stats.totalScore);

  const privacy = {
    publicProfile: !!mentee.privacy?.publicProfile,
    showRank: mentee.privacy?.showRank !== false,
    recruiterVisible: !!mentee.privacy?.recruiterVisible,
  };
  const hideRank = mode === 'public' && !privacy.showRank;

  const card = {
    mode,
    me: {
      id: String(mentee._id),
      name: mentee.name,
      enrollmentNumber: mentee.enrollmentNumber,
      program: programs[0]?.name || 'TechNeeds',
      memberSince: mentee.createdAt,
      interests: mentee.interests || [],
    },
    level: lvl,
    rarity: rarity(rank, board.length),
    rank: hideRank ? null : rank,
    totalMentees: board.length,
    score: stats.totalScore,
    streak: stats.streak,
    completed: stats.completed,
    totalResources: stats.totalResources,
    avatar: avatarTraits({ interests: mentee.interests, topTag: stats.topTag, skills: skillsNow, level: lvl.level, streak: stats.streak, name: mentee.name }),
    ai: {
      archetype: ai.archetype,
      headline: ai.headline,
      summary: ai.summary,
      strengths: ai.strengths || [],
      growthAreas: ai.growthAreas || [],
    },
    aiSource,
    aiModel: aiSource === 'gemini' ? aiModel : null,
    aiJob,
    aiPipeline: pipeline.enabled() ? 'render-workflows' : 'inline',
    aiGeneratedAt: aiAt,
    facts: stats.facts,
    skills,
    constellation: constellation(rows, mentee.interests, recIds),
    badges: badgeShelf(ai, stats, rows, rank),
    journey: journey(timeline, resources),
    endorsement: mentee.endorsement?.text
      ? { text: mentee.endorsement.text, mentorName: mentee.endorsement.mentorName, at: mentee.endorsement.at }
      : null,
    openToOpportunities: privacy.recruiterVisible,
  };

  if (mode !== 'public') {
    card.forecast = fc;
    card.nextMissions = missions.slice(0, 3);
    card.privacy = privacy;
    card.email = mentee.email;
  }
  return card;
}

module.exports = { buildCard, skillVector, forecast, levelInfo, avatarTraits };
