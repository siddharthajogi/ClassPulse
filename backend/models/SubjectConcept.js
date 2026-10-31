const mongoose = require('mongoose');

const subjectConceptSchema = new mongoose.Schema({
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Concept name is required'],
    trim: true,
    maxlength: [150, 'Concept name cannot exceed 150 characters']
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  academicYear: {
    type: String,
    trim: true,
    default: ''
  },
  semester: {
    type: String,
    trim: true,
    default: ''
  },
  difficultyLevel: {
    type: String,
    enum: ['Fundamental', 'Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate'
  },
  orderIndex: {
    type: Number,
    default: 0
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectConcept'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Prevent duplicate concept names within the same subject in an institution
subjectConceptSchema.index({ institution: 1, subject: 1, name: 1 }, { unique: true });
subjectConceptSchema.index({ institution: 1, subject: 1, isActive: 1 });

module.exports = mongoose.model('SubjectConcept', subjectConceptSchema);
