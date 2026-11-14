const jwt = require('jsonwebtoken');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');

// Tokens carry a role claim: 'mentor' | 'mentee'. Core-team rights are checked on the mentor record.
function readToken(req) {
  const header = req.header('x-auth-token');
  if (header) return header;
  const auth = req.header('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function verify(req, res) {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

exports.signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// --- Core team (admin permission on a mentor account) --- //
// There is no separate admin login: core-team members log in as mentors.
// ADMIN_EMAILS (comma-separated, or the older ADMIN_EMAIL) bootstraps the first core team.
const adminEmails = () =>
  (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isCoreTeam = (mentor) => !!mentor && (mentor.isAdmin === true || adminEmails().includes(String(mentor.email || '').toLowerCase()));
exports.isCoreTeam = isCoreTeam;

exports.authenticateAdmin = async (req, res, next) => {
  const decoded = verify(req, res);
  if (!decoded) return;
  if (decoded.role !== 'mentor') return res.status(403).json({ error: 'Core team access required' });
  try {
    const mentor = await Mentor.findById(decoded.id).select('-password');
    if (!mentor) return res.status(401).json({ error: 'Mentor not found' });
    if (!isCoreTeam(mentor)) return res.status(403).json({ error: 'Core team access required' });
    req.mentor = mentor;
    req.admin = { email: mentor.email, name: mentor.name };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Mentor --- //
exports.authenticate = async (req, res, next) => {
  const decoded = verify(req, res);
  if (!decoded) return;
  if (decoded.role && decoded.role !== 'mentor') {
    return res.status(403).json({ error: 'Mentor access required' });
  }
  try {
    const mentor = await Mentor.findById(decoded.id).select('-password');
    if (!mentor) return res.status(401).json({ error: 'Mentor not found' });
    req.mentor = mentor;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Any staff member (mentor; core team also gets req.admin) --- //
exports.authenticateStaff = async (req, res, next) => {
  const decoded = verify(req, res);
  if (!decoded) return;
  if (decoded.role !== 'mentor') return res.status(403).json({ error: 'Staff access required' });
  const mentor = await Mentor.findById(decoded.id).select('-password');
  if (!mentor) return res.status(401).json({ error: 'Mentor not found' });
  req.mentor = mentor;
  if (isCoreTeam(mentor)) req.admin = { email: mentor.email, name: mentor.name };
  next();
};

// --- Mentee --- //
exports.authenticateMentee = async (req, res, next) => {
  const decoded = verify(req, res);
  if (!decoded) return;
  if (decoded.role && decoded.role !== 'mentee') {
    return res.status(403).json({ error: 'Mentee access required' });
  }
  try {
    const mentee = await Mentee.findById(decoded.id).select('-password');
    if (!mentee) return res.status(401).json({ error: 'Mentee not found' });
    req.mentee = mentee;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper: does this mentor own the program?
// Core team can act on every program.
exports.mentorOwnsProgram = (mentor, programId) =>
  isCoreTeam(mentor) || (mentor.programs || []).some((p) => String(p._id || p) === String(programId));
