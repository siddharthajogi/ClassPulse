const mongoose = require('mongoose');

const teacherProfileSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teacherId: { type: String, required: true, unique: true, index: true },
  department: { type: String, required: true },
  departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation: { type: String, required: true },
  personalInfo: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String },
    address: { type: String }
  },
  professionalInfo: {
    qualifications: { type: [String], default: [] },
    highestQualification: { type: String, trim: true },
    specialization: { type: String },
    yearsOfExperience: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('TeacherProfile', teacherProfileSchema);
