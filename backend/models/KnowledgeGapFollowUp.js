const mongoose = require('mongoose');

const knowledgeGapFollowUpSchema = new mongoose.Schema({
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
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile',
    required: true,
    index: true
  },
  concept: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectConcept',
    required: true,
    index: true
  },
  reviewStatus: {
    type: String,
    enum: ['Needs Review', 'Under Review', 'Action Taken', 'Resolved', 'Monitoring'],
    default: 'Needs Review'
  },
  notes: {
    type: String,
    trim: true,
    default: '',
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Ensure unique follow-up per student-concept pair within an institution/subject
knowledgeGapFollowUpSchema.index(
  { institution: 1, subject: 1, student: 1, concept: 1 },
  { unique: true }
);

module.exports = mongoose.model('KnowledgeGapFollowUp', knowledgeGapFollowUpSchema);
