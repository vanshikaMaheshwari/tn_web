const mongoose = require('mongoose');

// Cohort structure: Module → sub-topics → missions (Resources point at module + subtopic).
const SubtopicSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, maxlength: 400 },
  order: { type: Number, default: 0 },
  lockUntilPrevious: { type: Boolean, default: false },
});

const ModuleSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, maxlength: 400 },
  order: { type: Number, default: 0 },
  startsAt: { type: Date },
  endsAt: { type: Date },
  subtopics: [SubtopicSchema],
}, { timestamps: true });

module.exports = mongoose.model('Module', ModuleSchema);
