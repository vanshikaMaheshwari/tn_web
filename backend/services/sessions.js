// Shared shaping of live classes for mentors and mentees.
const Module = require('../models/Module');
const { youtubeId, driveId } = require('./media');

const MIN = 60000;

function sessionStatus(s, now = Date.now()) {
  if (s.cancelled) return 'cancelled';
  const start = new Date(s.startsAt).getTime();
  const end = start + (s.durationMin || 60) * MIN;
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
}

// Adds status, endsAt, module/sub-topic names and playable-recording info.
async function shapeSessions(sessions) {
  const modIds = [...new Set(sessions.map((s) => s.module && String(s.module)).filter(Boolean))];
  const mods = modIds.length ? await Module.find({ _id: { $in: modIds } }).select('title subtopics._id subtopics.title').lean() : [];
  const modMap = new Map(mods.map((m) => [String(m._id), m]));
  const now = Date.now();
  return sessions.map((s) => {
    const m = s.module ? modMap.get(String(s.module)) : null;
    const st = m && s.subtopic ? m.subtopics.find((x) => String(x._id) === String(s.subtopic)) : null;
    return {
      ...s,
      endsAt: new Date(new Date(s.startsAt).getTime() + (s.durationMin || 60) * MIN),
      status: sessionStatus(s, now),
      moduleTitle: m?.title || null,
      subtopicTitle: st?.title || null,
      recording: s.recordingUrl ? { url: s.recordingUrl, youtubeId: youtubeId(s.recordingUrl), driveId: driveId(s.recordingUrl) } : null,
    };
  });
}

module.exports = { sessionStatus, shapeSessions };
