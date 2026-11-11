const jwt = require('jsonwebtoken');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');

// Tokens carry a role claim: 'admin' | 'mentor' | 'mentee'.
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

// --- Admin --- //
exports.authenticateAdmin = (req, res, next) => {
  const decoded = verify(req, res);
  if (!decoded) return;
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  req.admin = { email: process.env.ADMIN_EMAIL };
  next();
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

// --- Admin OR mentor (read-only shared endpoints) --- //
exports.authenticateStaff = async (req, res, next) => {
  const decoded = verify(req, res);
  if (!decoded) return;
  if (decoded.role === 'admin') {
    req.admin = { email: process.env.ADMIN_EMAIL };
    return next();
  }
  if (decoded.role === 'mentee') return res.status(403).json({ error: 'Staff access required' });
  const mentor = await Mentor.findById(decoded.id).select('-password');
  if (!mentor) return res.status(401).json({ error: 'Mentor not found' });
  req.mentor = mentor;
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
exports.mentorOwnsProgram = (mentor, programId) =>
  (mentor.programs || []).some((p) => p.toString() === String(programId));
