const mongoose = require('mongoose');

// Public events shown on /events. Status (live / upcoming / past) is derived from the dates.
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['hackathon', 'workshop', 'talk', 'bootcamp', 'contest', 'cohort-launch', 'orientation', 'pitch', 'challenge', 'other'], default: 'other' },
  description: { type: String, maxlength: 600 },
  tracks: [{ type: String, trim: true, maxlength: 40 }],
  startsAt: { type: Date, required: true },
  endsAt: { type: Date },
  dateLabel: { type: String, maxlength: 60 }, // optional human label, e.g. "1 Jan onwards"
  mode: { type: String, enum: ['online', 'offline', 'hybrid'], default: 'offline' },
  venue: { type: String, maxlength: 140 },
  registerUrl: { type: String, maxlength: 500 },
  registrationClosesAt: { type: Date },
  imageUrl: { type: String, maxlength: 500 },
  gallery: [{ type: String, maxlength: 500 }],
  recapUrl: { type: String, maxlength: 500 },
  highlight: { type: String, maxlength: 140 }, // e.g. "3500+ registrations"
  color: { type: String, default: '#FFE45C' },
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' },
}, { timestamps: true });

EventSchema.methods.status = function status(now = Date.now()) {
  if (!this.published) return 'draft';
  const start = new Date(this.startsAt).getTime();
  const end = this.endsAt ? new Date(this.endsAt).getTime() : start + 4 * 3600 * 1000;
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'past';
};

module.exports = mongoose.model('Event', EventSchema);
