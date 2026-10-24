const mongoose = require('mongoose');

const riskPredictionSchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, unique: true },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
  score: { type: Number, min: 0, max: 100 }, // e.g., probability score from ML model
  predictionDate: { type: Date, default: Date.now },
  factors: [{ type: String }] // Key factors influencing the prediction
}, { timestamps: true });

module.exports = mongoose.model('RiskPrediction', riskPredictionSchema);
