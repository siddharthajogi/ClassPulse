const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String },
  description: { type: String },
  type: { type: String }, // e.g., University, College, High School
  website: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  email: { type: String },
  phone: { type: String },
  timezone: { type: String, default: 'UTC' },
  isSetupComplete: { type: Boolean, default: false },
  logoUrl: { type: String }, // Optional logo URL if supported later
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Institution', institutionSchema);
