const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionNumber: {
    type: String,
    required: [true, 'Question identifier is required (e.g. Q1, Q2)'],
    trim: true
  },
  text: {
    type: String,
    trim: true,
    default: ''
  },
  maxMarks: {
    type: Number,
    required: [true, 'Maximum marks is required'],
    min: [0.25, 'Maximum marks must be greater than 0']
  },
  concepts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectConcept'
  }]
}, { _id: true });

const studentQuestionScoreSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  marksObtained: {
    type: Number,
    required: true,
    min: [0, 'Marks obtained cannot be negative']
  }
}, { _id: false });

const assessmentSchema = new mongoose.Schema({
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Assessment title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    index: true
  },
  teachingAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeachingAssignment'
  },
  assessmentType: {
    type: String,
    enum: ['Quiz', 'Assignment', 'Midterm', 'Final', 'Continuous Assessment', 'Lab Practical', 'Other'],
    default: 'Continuous Assessment'
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
  assessmentDate: {
    type: Date
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  questions: [questionSchema],
  studentScores: [studentQuestionScoreSchema],
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

assessmentSchema.index({ institution: 1, subject: 1, classRef: 1, isActive: 1 });
assessmentSchema.index({ institution: 1, teachingAssignment: 1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
