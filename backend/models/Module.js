const mongoose = require('mongoose');

// Cohort structure: Module → sub-topics → missions (Resources point at module + subtopic).
// Each sub-topic can also carry curated reference videos (watch-along material, no points).
const ReferenceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  url: { type: String, required: true, trim: true, maxlength: 400 },
  channel: { type: String, trim: true, maxlength: 80 },
  minutes: { type: Number, min: 0, max: 600 },
  addedBy: String,
});

const SubtopicSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, maxlength: 400 },
  order: { type: Number, default: 0 },
  lockUntilPrevious: { type: Boolean, default: false },
  references: [ReferenceSchema],
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
