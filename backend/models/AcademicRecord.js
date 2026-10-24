const mongoose = require('mongoose');

const academicRecordSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  termId: { type: mongoose.Schema.Types.ObjectId }, // Reference to the specific term in AcademicYear.terms
  marksObtained: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  attendancePercentage: { type: Number },
  classesAttended: { type: Number },
  totalClassesHeld: { type: Number },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AcademicRecord', academicRecordSchema);
