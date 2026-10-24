const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, index: true },
  targetResource: { type: mongoose.Schema.Types.ObjectId, index: true }, // The ID of the affected document (e.g. User, StudentProfile)
  resourceModel: { type: String }, // Which model the targetResource belongs to
  metadata: { type: mongoose.Schema.Types.Mixed }, // Safe additional data
  status: { type: String, enum: ['success', 'failure'], default: 'success' }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
