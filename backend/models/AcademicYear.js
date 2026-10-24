const mongoose = require('mongoose');

const termSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Semester 1", "Fall Term"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false } // Only one term should be active at a time within an active year
});

const academicYearSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  year: { type: String, required: true }, // Removed global unique constraint, will use compound index

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  structureType: { type: String, required: true }, // e.g., "Semester", "Annual", "Trimester"
  terms: [termSchema],
  isActive: { type: Boolean, default: false } // Globally active academic year
}, { timestamps: true });

academicYearSchema.index({ institution: 1, year: 1 }, { unique: true });

academicYearSchema.pre('save', function() {
  if (this.endDate <= this.startDate) {
    throw new Error('End date must be after start date.');
  }
});

module.exports = mongoose.model('AcademicYear', academicYearSchema);
