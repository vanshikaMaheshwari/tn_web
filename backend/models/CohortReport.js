const mongoose = require('mongoose');

// Weekly report per cohort, written by the "weeklyCohortReport" Render Workflow task.
// The numbers are computed first; "summarizeCohortReport" then asks Gemini for a
// short write-up (with retries). If Gemini never answers, the rules summary stays.
const CohortReportSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  programName: String,
  periodStart: Date,
  periodEnd: Date,
  stats: { type: mongoose.Schema.Types.Mixed },
  summary: String,
  highlights: [String],
  summarySource: { type: String, enum: ['gemini', 'rules'], default: 'rules' },
  model: String,
  runId: String,
  via: { type: String, enum: ['render-workflows', 'inline'], default: 'inline' },
}, { timestamps: true });

CohortReportSchema.index({ program: 1, createdAt: -1 });

module.exports = mongoose.model('CohortReport', CohortReportSchema);
