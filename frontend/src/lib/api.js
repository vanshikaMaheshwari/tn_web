// Single API client for TechNeeds 2.0.
// Base URL comes from NEXT_PUBLIC_API_URL (defaults to the local backend on :8000).
export const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const TOKEN_KEY = 'tn_token';
const ROLE_KEY = 'tn_role';
const NAME_KEY = 'tn_name';

// ---------- session ----------
export const session = {
  get() {
    if (typeof window === 'undefined') return { token: null, role: null, name: null };
    try {
      return {
        token: localStorage.getItem(TOKEN_KEY),
        role: localStorage.getItem(ROLE_KEY),
        name: localStorage.getItem(NAME_KEY),
      };
    } catch {
      return { token: null, role: null, name: null };
    }
  },
  set({ token, role, name }) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, role);
      if (name) localStorage.setItem(NAME_KEY, name);
      // legacy keys used by the original panels
      if (role === 'mentee') localStorage.setItem('menteeToken', token);
      if (role === 'mentor') localStorage.setItem('token', token);
    } catch { /* storage unavailable */ }
  },
  clear() {
    try {
      [TOKEN_KEY, ROLE_KEY, NAME_KEY, 'menteeToken', 'token'].forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  },
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const { token } = session.get();
    if (token) headers['x-auth-token'] = token;
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) session.clear();
    throw new ApiError(data.error || data.message || `Request failed (${res.status})`, res.status);
  }
  return data;
}

// ---------- auth ----------
export async function login(role, { id, password }) {
  if (role === 'mentee') {
    const d = await request('/api/m/login', { method: 'POST', auth: false, body: { enrollmentNumber: id, password } });
    session.set({ token: d.token, role, name: d.name });
    return d;
  }
  if (role === 'mentor') {
    const d = await request('/api/mentors/login', { method: 'POST', auth: false, body: { email: id, password } });
    session.set({ token: d.token, role, name: d.mentor?.name });
    return d;
  }
  throw new ApiError('Unknown role', 400);
}
export const logout = () => session.clear();

// ---------- public ----------
export const getLeaderboard = (programId) =>
  request(`/api/m/leaderboard${programId ? `?program=${programId}` : ''}`, { auth: false });
export const getPublicPrograms = () => request('/api/m/programs/public', { auth: false });

// ---------- mentee ----------
export const getDashboard = () => request('/api/m/dashboard');
export const completeVideo = (id) => request(`/api/m/resources/${id}/complete`, { method: 'POST' });
export const getQuiz = (id) => request(`/api/m/resources/${id}/quiz`);
export const submitQuiz = (id, answers) => request(`/api/m/resources/${id}/quiz/submit`, { method: 'POST', body: { answers } });
export const submitProject = (id, body) => request(`/api/m/resources/${id}/project`, { method: 'POST', body });
export const getProfile = () => request('/api/m/profile');
export const generateAiProfile = (force = false) => request('/api/m/profile/ai', { method: 'POST', body: { force } });
export const updateInterests = (interests) => request('/api/m/interests', { method: 'PUT', body: { interests } });
export const getCard = () => request('/api/m/card');
export const refreshCard = () => request('/api/m/card/ai', { method: 'POST' });
export const getCardAiStatus = () => request('/api/m/card/ai/status');
export const updatePrivacy = (body) => request('/api/m/privacy', { method: 'PUT', body });
export const getPublicCard = (enrollment) => request(`/api/m/u/${encodeURIComponent(enrollment)}`, { auth: false });
export const changePassword = (currentPassword, newPassword) =>
  request('/api/m/change-password', { method: 'POST', body: { currentPassword, newPassword } });

// ---------- mentor ----------
export const getMentorMe = () => request('/api/mentors/me');
export const getMyPrograms = () => request('/api/programs');
export const getProgramMentees = (programId) => request(`/api/${programId}/mentees`);
export const getProgramResources = (programId) => request(`/api/${programId}/resources`);
export const addMentee = (body) => request('/api/mentees', { method: 'POST', body });
export const resetMenteePassword = (menteeId) => request(`/api/mentees/${menteeId}/reset-password`, { method: 'POST' });
export const createResource = (body) => request('/api/resources', { method: 'POST', body });
export const createQuiz = (body) => request('/api/resources/quiz', { method: 'POST', body });
export const deleteResource = (id) => request(`/api/resources/${id}`, { method: 'DELETE' });
export const getMenteeCard = (menteeId) => request(`/api/mentees/${menteeId}/card`);
export const endorseMentee = (menteeId, text) => request(`/api/mentees/${menteeId}/endorse`, { method: 'PUT', body: { text } });
export const getUnverifiedProjects = () => request('/api/unverified-projects');
export const verifyProject = (menteeId, resourceId, score, feedback) =>
  request(`/api/${menteeId}/resources/${resourceId}/verify`, { method: 'PATCH', body: { score, feedback } });

// ---------- admin ----------
export const getAdminStats = () => request('/api/admin/stats');
export const refreshAllAiCards = () => request('/api/admin/ai/refresh-all', { method: 'POST', body: { staleHours: 6 } });
export const getAiRun = (runId) => request(`/api/admin/ai/runs/${runId}`);
// Automations (Render Workflows)
export const getAutomations = () => request('/api/admin/automations');
export const startAutomation = (task, body = {}) => request(`/api/admin/automations/${task}`, { method: 'POST', body });
export const getReminders = () => request('/api/m/reminders');
export const getCohortReport = (programId) => request(`/api/programs/${programId}/report`);
export const getAllPrograms = () => request('/api/programs?all=1');
export const setCoreTeam = (mentorId, isAdmin) => request(`/api/admin/mentors/${mentorId}/core`, { method: 'PUT', body: { isAdmin } });
export const getAdminEvents = () => request('/api/admin/events');
export const createEvent = (body) => request('/api/admin/events', { method: 'POST', body });
export const updateEvent = (id, body) => request(`/api/admin/events/${id}`, { method: 'PUT', body });
export const deleteEvent = (id) => request(`/api/admin/events/${id}`, { method: 'DELETE' });
export const getAdminQueries = (status) => request(`/api/admin/queries${status ? `?status=${status}` : ''}`);
export const updateQuery = (id, body) => request(`/api/admin/queries/${id}`, { method: 'PUT', body });
export const getAdminFeedback = () => request('/api/admin/feedback');
export const setAnnouncement = (text) => request('/api/admin/announcement', { method: 'PUT', body: { text } });

// ---------- community (public) ----------
export const getEvents = () => request('/api/events', { auth: false });
export const sendEventFeedback = (id, body) => request(`/api/events/${id}/feedback`, { method: 'POST', body, auth: false });
export const sendFeedback = (body) => request('/api/feedback', { method: 'POST', body });
export const sendQuery = (body) => request('/api/queries', { method: 'POST', body, auth: false });
export const trackQuery = (ticket, email) => request(`/api/queries/track?ticket=${encodeURIComponent(ticket)}&email=${encodeURIComponent(email)}`, { auth: false });
export const getTechboard = () => request('/api/techboard', { auth: false });

// ---------- modules (mentor) ----------
export const getModules = (programId) => request(`/api/programs/${programId}/modules`);
export const createModule = (programId, body) => request(`/api/programs/${programId}/modules`, { method: 'POST', body });
export const updateModule = (id, body) => request(`/api/modules/${id}`, { method: 'PUT', body });
export const deleteModule = (id) => request(`/api/modules/${id}`, { method: 'DELETE' });
export const reorderModules = (programId, order) => request(`/api/programs/${programId}/modules/order`, { method: 'PUT', body: { order } });
export const addSubtopic = (moduleId, body) => request(`/api/modules/${moduleId}/subtopics`, { method: 'POST', body });
export const updateSubtopic = (moduleId, subId, body) => request(`/api/modules/${moduleId}/subtopics/${subId}`, { method: 'PUT', body });
export const deleteSubtopic = (moduleId, subId) => request(`/api/modules/${moduleId}/subtopics/${subId}`, { method: 'DELETE' });
export const placeResource = (resourceId, module, subtopic) => request(`/api/resources/${resourceId}/placement`, { method: 'PUT', body: { module, subtopic } });
export const createProgram = (name, description) => request('/api/programs', { method: 'POST', body: { name, description } });
export const getAllMentors = () => request('/api/mentors');
export const createMentor = (name, email) => request('/api/mentors', { method: 'POST', body: { name, email } });
export const assignMentor = (programId, mentorId) =>
  request(`/api/programs/${programId}/add-mentor`, { method: 'POST', body: { mentorId } });
export const removeMentor = (programId, mentorId) =>
  request(`/api/programs/${programId}/remove-mentor`, { method: 'POST', body: { mentorId } });

// ---------- helpers ----------
export function timeLeft(date) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const txt = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { ms, txt, past: ms < 0 };
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'TN';
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export const avatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || 'techneeds')}&backgroundColor=2f6bff,4fd1ff,ffe45c`;
