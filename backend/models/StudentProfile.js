const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentId: { type: String, required: true, unique: true, index: true },
  course: { type: String, required: true },
  department: { type: String, required: true },
  departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  academicYear: { type: String, required: true },
  semester: { type: String, required: true },
  yearOfStudy: { type: String, trim: true },
  classRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  section: { type: String },
  batch: { type: String },
  personalInfo: {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String },
    dateOfBirth: { type: Date },
    address: { type: String }
  },
  learningProfile: {
    preferences: { type: String },
    history: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
