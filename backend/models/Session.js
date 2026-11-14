const mongoose = require('mongoose');

// A live class (Google Meet) scheduled by a mentor for a cohort, and/or its recording.
// A "recording only" entry (no meetUrl) is a recorded lecture added straight to the library.
const SessionSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  agenda: { type: String, maxlength: 1000 },
  startsAt: { type: Date, required: true },
  durationMin: { type: Number, default: 60, min: 10, max: 480 },
  meetUrl: { type: String, maxlength: 300 },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  subtopic: { type: mongoose.Schema.Types.ObjectId },
  recordingUrl: { type: String, maxlength: 400 },
  recordingNotes: { type: String, maxlength: 600 },
  cancelled: { type: Boolean, default: false },
  host: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' },
}, { timestamps: true });

SessionSchema.index({ program: 1, startsAt: 1 });

module.exports = mongoose.model('Session', SessionSchema);
