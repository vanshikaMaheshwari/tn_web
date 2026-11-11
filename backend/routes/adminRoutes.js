const express = require('express');
const crypto = require('crypto');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Program = require('../models/Program');
const Resource = require('../models/Resource');
const { authenticateAdmin, signToken } = require('../middleware/authMentor');
const router = express.Router();

// Constant-time string compare so login timing doesn't leak the password.
const safeEqual = (a = '', b = '') => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

// Admin credentials live in env (ADMIN_EMAIL / ADMIN_PASSWORD) — no admin
// endpoints are reachable without the resulting token.
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin credentials are not configured on the server' });
  }
  const ok =
    safeEqual((email || '').toLowerCase().trim(), process.env.ADMIN_EMAIL.toLowerCase()) &&
    safeEqual(password, process.env.ADMIN_PASSWORD);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  res.json({ token: signToken('admin', 'admin'), admin: { email: process.env.ADMIN_EMAIL } });
});

router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const [programs, mentors, mentees, resources] = await Promise.all([
      Program.countDocuments(),
      Mentor.countDocuments(),
      Mentee.countDocuments(),
      Resource.countDocuments(),
    ]);
    const unassignedPrograms = await Program.countDocuments({ mentors: { $size: 0 } });
    res.json({ programs, mentors, mentees, resources, unassignedPrograms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
