const mongoose = require('mongoose');

const teachingAssignmentSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherProfile', required: false, default: null },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  classRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  dueDate: { type: Date },
  status: { type: String, default: 'Active' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// A subject shouldn't be assigned more than once to the same group/class in an institution
teachingAssignmentSchema.index({ institution: 1, classRef: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('TeachingAssignment', teachingAssignmentSchema);
