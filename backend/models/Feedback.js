const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  source: { type: String, enum: ['event', 'mission', 'site'], required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  mentee: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentee' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 },
  name: { type: String, maxlength: 60 },
  page: { type: String, maxlength: 120 },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);
