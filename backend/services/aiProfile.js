// AI profile generation: Gemini first, deterministic rules as a fallback so the
// profile page always renders (no key, quota hit, network error, bad JSON).

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const BADGE_ICONS = ['flame', 'target', 'code', 'rocket', 'trophy', 'book', 'zap', 'star', 'clock', 'brain'];

function buildPrompt(stats) {
  return `You are the profile writer for TechNeeds IGDTUW, a peer mentorship community for women in tech.
Write a short, encouraging but honest learner profile from the JSON stats below.
Rules:
- Use ONLY facts present in the stats. Never invent numbers, skills or events.
- Address the learner in second person.
- "archetype": 2-4 words starting with "The", a playful learner title (e.g. "The Night-Owl Builder").
- "headline": max 14 words, second person, one strength + one unlock (e.g. "You ship fast and never miss a deadline. Projects are your next unlock.").
- "summary": 2-3 sentences in second person. Mention one strength and one concrete growth lever.
  Every number or achievement you mention MUST be copied exactly from "facts" and wrapped in double brackets, e.g. "You kept a [[12-day streak]]". Do not wrap anything that is not in "facts".
- "badges": 3-5 items earned from the data; "icon" must be one of: ${BADGE_ICONS.join(', ')}.
- "recommendations": 3 items. Prefer pending resources from "pending" (copy their "id" into resourceId); otherwise suggest a topic tied to the learner's interests (resourceId null).
- "skills": 5 axes scored 0-100: videos, quizzes, projects, consistency, punctuality — derive from the stats.

Facts (the only phrases you may put in [[ ]]):
${JSON.stringify(stats.facts || [])}

Stats:
${JSON.stringify(stats, null, 2)}`;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    archetype: { type: 'STRING' },
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    growthAreas: { type: 'ARRAY', items: { type: 'STRING' } },
    badges: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, icon: { type: 'STRING' }, reason: { type: 'STRING' } },
        required: ['name', 'icon', 'reason'],
      },
    },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, why: { type: 'STRING' }, resourceId: { type: 'STRING', nullable: true } },
        required: ['title', 'why'],
      },
    },
    skills: {
      type: 'OBJECT',
      properties: {
        videos: { type: 'NUMBER' }, quizzes: { type: 'NUMBER' }, projects: { type: 'NUMBER' },
        consistency: { type: 'NUMBER' }, punctuality: { type: 'NUMBER' },
      },
      required: ['videos', 'quizzes', 'projects', 'consistency', 'punctuality'],
    },
  },
  required: ['archetype', 'headline', 'summary', 'badges', 'recommendations', 'skills'],
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

// Keep [[evidence]] markers only around phrases that really are in the facts list.
function verifyEvidence(text, facts = []) {
  const allowed = new Set(facts);
  return String(text || '').replace(/\[\[(.+?)\]\]/g, (m, inner) => (allowed.has(inner.trim()) ? `[[${inner.trim()}]]` : inner));
}

function normalize(p, stats) {
  const pendingIds = new Set(stats.pending.map((x) => x.id));
  const arche = String(p.archetype || '').replace(/["“”]/g, '').trim().slice(0, 40);
  return {
    archetype: arche ? (/^the /i.test(arche) ? arche : `The ${arche}`) : 'The Fresh Launcher',
    headline: String(p.headline || '').slice(0, 120),
    summary: verifyEvidence(p.summary, stats.facts).slice(0, 700),
    strengths: (p.strengths || []).slice(0, 4).map(String),
    growthAreas: (p.growthAreas || []).slice(0, 4).map(String),
    badges: (p.badges || []).slice(0, 5).map((b) => ({
      name: String(b.name).slice(0, 40),
      icon: BADGE_ICONS.includes(b.icon) ? b.icon : 'star',
      reason: String(b.reason).slice(0, 160),
    })),
    recommendations: (p.recommendations || []).slice(0, 3).map((r) => ({
      title: String(r.title).slice(0, 90),
      why: String(r.why).slice(0, 200),
      resourceId: r.resourceId && pendingIds.has(r.resourceId) ? r.resourceId : null,
    })),
    skills: Object.fromEntries(
      ['videos', 'quizzes', 'projects', 'consistency', 'punctuality'].map((k) => [k, clamp(p.skills?.[k])])
    ),
  };
}

async function generateWithGemini(stats) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(stats) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
    return normalize(JSON.parse(text), stats);
  } finally {
    clearTimeout(timer);
  }
}

// Deterministic generator with the same output shape.
function generateWithRules(stats) {
  const { byType, avgScorePct, onTimeRate, streak, rank, totalMentees, interests, pending, name } = stats;
  const first = name.split(' ')[0];
  const pct = (t) => (byType[t].total ? Math.round((byType[t].done / byType[t].total) * 100) : 0);
  const skills = {
    videos: pct('video'),
    quizzes: byType.quiz.avgPct ?? pct('quiz'),
    projects: byType.project.avgPct ?? pct('project'),
    consistency: clamp(streak * 8),
    punctuality: clamp(onTimeRate),
  };
  const top = Object.entries(skills).sort((a, b) => b[1] - a[1]);
  const strongest = top[0][0];
  const weakest = top[top.length - 1][0];
  const focus = interests[0] ? interests[0].replace(/_/g, ' ') : 'tech';

  const badges = [];
  if (streak >= 3) badges.push({ name: 'Streak Keeper', icon: 'flame', reason: `${streak} active days in a row.` });
  if ((byType.quiz.avgPct || 0) >= 80) badges.push({ name: 'Quiz Ace', icon: 'target', reason: `Averaging ${byType.quiz.avgPct}% on quizzes.` });
  if (byType.video.done >= 3) badges.push({ name: 'Binge Learner', icon: 'book', reason: `${byType.video.done} video modules completed.` });
  if (byType.project.done >= 1) badges.push({ name: 'Builder', icon: 'rocket', reason: `${byType.project.done} project${byType.project.done > 1 ? 's' : ''} shipped.` });
  if (onTimeRate >= 90 && stats.completed >= 3) badges.push({ name: 'Always On Time', icon: 'clock', reason: `${onTimeRate}% of work submitted before the deadline.` });
  if (rank && rank <= 3) badges.push({ name: 'Podium', icon: 'trophy', reason: `Ranked #${rank} on the leaderboard.` });
  if (badges.length === 0) badges.push({ name: 'First Steps', icon: 'star', reason: 'Joined the cohort and started the journey.' });

  const recs = pending.slice(0, 2).map((p) => ({
    title: `${p.type === 'quiz' ? 'Attempt' : p.type === 'project' ? 'Submit' : 'Complete'}: ${p.title}`,
    why: p.daysLeft !== null && p.daysLeft <= 2
      ? `Due ${p.daysLeft <= 0 ? 'today' : `in ${p.daysLeft} day${p.daysLeft > 1 ? 's' : ''}`} — worth ${p.maxScore} pts.`
      : `Worth ${p.maxScore} pts toward your rank.`,
    resourceId: p.id,
  }));
  recs.push({ title: `Go deeper on ${focus}`, why: `Matches your interest in ${focus}; pick a small build to practise ${weakest}.`, resourceId: null });

  const label = { videos: 'video learning', quizzes: 'quizzes', projects: 'projects', consistency: 'consistency', punctuality: 'meeting deadlines' };
  const noun = { videos: 'Explorer', quizzes: 'Problem-Solver', projects: 'Builder', consistency: 'Grinder', punctuality: 'Planner' };
  const rhythm = stats.rhythm === 'night' ? 'Night-Owl' : stats.rhythm === 'morning' ? 'Early-Bird' : streak >= 5 ? 'Steady' : 'Rising';
  const f = Object.fromEntries((stats.factList || []).map((x) => [x.key, `[[${x.text}]]`]));
  const bits = [];
  if (f.quizOnTime) bits.push(`you finished ${f.quizOnTime}`);
  if (f.streak) bits.push(`kept a ${f.streak}`);
  if (!bits.length && f.done) bits.push(`you have completed ${f.done}`);
  const s1 = bits.length ? `${bits.join(' and ')}${f.rank ? `, which puts you at ${f.rank}` : ''}.` : 'Your journey is just getting started.';
  const s2 = f.topTrack ? ` You are ${f.topTrack}.` : '';
  const s3 = f.projects && weakest === 'projects'
    ? ` Your clearest lever: only ${f.projects} submitted, so projects are your next unlock.`
    : ` Focusing on ${label[weakest]} is the clearest way to climb further.`;
  return {
    archetype: stats.completed ? `The ${rhythm} ${noun[strongest]}` : 'The Fresh Launcher',
    headline: stats.completed
      ? `You shine at ${label[strongest]}. ${label[weakest].charAt(0).toUpperCase() + label[weakest].slice(1)} ${['quizzes', 'projects'].includes(weakest) ? 'are' : 'is'} your next unlock.`
      : `Welcome aboard, ${first}! Your first mission is waiting.`,
    summary: (s1.charAt(0).toUpperCase() + s1.slice(1) + s2 + s3).trim(),
    strengths: [label[strongest], label[top[1][0]]],
    growthAreas: [label[weakest]],
    badges: badges.slice(0, 5),
    recommendations: recs.slice(0, 3),
    skills,
  };
}

async function generateProfile(stats) {
  try {
    return { profile: await generateWithGemini(stats), source: 'gemini' };
  } catch (err) {
    if (process.env.GEMINI_API_KEY) console.warn('[aiProfile] Gemini failed, using rules:', err.message);
    return { profile: generateWithRules(stats), source: 'rules' };
  }
}

module.exports = { generateProfile, generateWithRules, verifyEvidence };
