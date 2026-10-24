const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

departmentSchema.index({ institution: 1, name: 1 }, { unique: true });
departmentSchema.index({ institution: 1, code: 1 }, { sparse: true });

module.exports = mongoose.model('Department', departmentSchema);
