const mongoose = require('mongoose');

const MenteeSchema = new mongoose.Schema({
  email: { type: String, required: true},
  name: { type: String, required: true },
  enrollmentNumber: { type: String, required: true },
  password: { type: String, required: true },
  programs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program'
  }],
  completedResources: [{
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    completedOn: { type: Date, default: Date.now },
    score: { type: Number, default: 0 },

    // Optional fields for project resources
    githubLink: { type: String },
    deployedLink: { type: String },
    description: { type: String },
    submittedOn: { type: Date },
    verified: { type: Boolean, default: false },
    feedback: { type: String },
  }],
  streak: { type: Number, default: 0 },
  interests: [{ type: String, trim: true, lowercase: true }],
  aiProfile: { type: mongoose.Schema.Types.Mixed },
  aiProfileAt: { type: Date },
  aiProfileSource: { type: String, enum: ['gemini', 'rules'] },
  totalScore: { type: Number, default: 0 },
  // AI card v2: privacy controls (all opt-in) and a short mentor endorsement
  privacy: {
    publicProfile: { type: Boolean, default: false },
    showRank: { type: Boolean, default: true },
    recruiterVisible: { type: Boolean, default: false },
  },
  endorsement: {
    text: { type: String, maxlength: 220 },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' },
    mentorName: { type: String },
    at: { type: Date },
  },
  lastActiveDate: { type: Date },
  
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Mentor',
  }
}, { timestamps: true });

MenteeSchema.index({ email: 1, enrollmentNumber: 1 }, { unique: true });

module.exports = mongoose.model('Mentee', MenteeSchema);
