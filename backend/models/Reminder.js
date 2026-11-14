const mongoose = require('mongoose');

// One row per mentee per day, written by the "deadlineDigest" Render Workflow task.
const ReminderSchema = new mongoose.Schema({
  mentee: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentee', required: true },
  day: { type: String, required: true }, // YYYY-MM-DD (IST)
  items: [{
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    program: String,
    title: String,
    type: { type: String },
    dueAt: Date,
    overdue: Boolean,
    maxScore: Number,
  }],
  runId: String,
}, { timestamps: true });

ReminderSchema.index({ mentee: 1, day: 1 }, { unique: true });
// Old reminders clean themselves up after 14 days.
ReminderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 3600 });

module.exports = mongoose.model('Reminder', ReminderSchema);
