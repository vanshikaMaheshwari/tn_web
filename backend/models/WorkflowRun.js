const mongoose = require('mongoose');

// History of Render Workflow runs started from TechNeeds (manual or scheduled),
// shown on the core team's Automations page.
const WorkflowRunSchema = new mongoose.Schema({
  task: { type: String, required: true },
  runId: String, // Render task run id (trn-…); empty for inline runs
  status: { type: String, enum: ['pending', 'running', 'succeeded', 'failed', 'canceled'], default: 'pending' },
  trigger: { type: String, enum: ['manual', 'schedule'], default: 'manual' },
  via: { type: String, enum: ['render-workflows', 'inline'], default: 'render-workflows' },
  by: String,
  result: { type: mongoose.Schema.Types.Mixed },
  error: String,
  retries: Number,
  finishedAt: Date,
}, { timestamps: true });

WorkflowRunSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WorkflowRun', WorkflowRunSchema);
