const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  name: { type: String, required: true, trim: true }, // e.g., "B.Tech - Computer Science and Engineering"
  course: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  academicYear: { type: String, required: true, trim: true },
  semester: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  yearOfStudy: { type: String, trim: true }, // 'First Year', 'Second Year', 'Third Year', 'Fourth Year'
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Prevent duplicate groups within an institution across all academic grouping fields
classSchema.index({
  institution: 1,
  course: 1,
  department: 1,
  academicYear: 1,
  semester: 1,
  section: 1
}, { unique: true });

module.exports = mongoose.model('Class', classSchema);
