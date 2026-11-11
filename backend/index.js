require('dotenv').config();
// Some ISPs/campus networks block the SRV lookups used by mongodb+srv:// URIs.
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')} — copy .env.example to .env`);
  process.exit(1);
}

const app = express();

// CORS_ORIGIN can be a comma-separated list; defaults to allowing all (local dev).
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('TechNeeds Mentorship API running'));
app.get('/api/health', (req, res) =>
  res.json({ ok: true, ai: process.env.GEMINI_API_KEY ? 'gemini' : 'rules' })
);

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/m', require('./routes/menteeRoutes'));
app.use('/api', require('./routes/mentorRoutes'));

// JSON 404 + error handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  connectDB().then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)));
}

module.exports = app;
