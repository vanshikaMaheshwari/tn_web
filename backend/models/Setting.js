const mongoose = require('mongoose');

// Small key/value store (e.g. the Techboard announcement).
const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  updatedBy: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);
