const mongoose = require('mongoose');

// Questions sent from the FAQ page ("Ask your question"); answered by the core team.
const QuerySchema = new mongoose.Schema({
  ticket: { type: String, unique: true },
  name: { type: String, required: true, maxlength: 60 },
  email: { type: String, required: true, maxlength: 120, lowercase: true, trim: true },
  topic: { type: String, enum: ['getting-started', 'joining', 'missions', 'ai-card', 'events', 'account', 'other'], default: 'other' },
  message: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['open', 'answered', 'resolved'], default: 'open' },
  reply: { type: String, maxlength: 2000 },
  repliedBy: { type: String },
  repliedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Query', QuerySchema);
