const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true, index: true },
  department: { type: String, required: true },
  departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  description: { type: String },
  subjectType: { type: String, default: 'Theory' },
  credits: { type: Number },
  semester: { type: String },
  academicYear: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

subjectSchema.index({ institution: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
