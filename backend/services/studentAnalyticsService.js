const AcademicRecord = require('../models/AcademicRecord');
const RiskPrediction = require('../models/RiskPrediction');

/**
 * studentAnalyticsService
 * 
 * Provides centralized, consistent, end-to-end calculations for:
 * 1. Attendance Percentage: (Classes Attended ÷ Total Classes Held) × 100
 * 2. Explainable Rule-Based Academic Risk Score (0 - 100)
 * 3. Automatic synchronization with RiskPrediction database records
 */

/**
 * Calculate attendance percentage for a set of academic records
 * Deduplicates records by subject and term/year to prevent duplicate counting
 * 
 * @param {Array} records - Array of AcademicRecord documents
 * @returns {Object} { attendancePercentage, classesAttended, totalClassesHeld, hasData }
 */
function calculateAttendanceFromRecords(records) {
  if (!records || records.length === 0) {
    return {
      attendancePercentage: null,
      classesAttended: 0,
      totalClassesHeld: 0,
      hasData: false
    };
  }

  // Sort descending by updatedAt / createdAt to keep the most recent record
  const sorted = [...records].sort((a, b) =>
    new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );

  const seenKeys = new Set();
  let totalAttended = 0;
  let totalHeld = 0;
  let hasValidDetailedCount = false;
  let percentageSum = 0;
  let percentageCount = 0;

  for (const r of sorted) {
    const yearKey = r.academicYear ? (r.academicYear._id || r.academicYear).toString() : 'no-yr';
    const subjKey = r.subject ? (r.subject._id || r.subject).toString() : 'no-subj';
    const termKey = r.termId ? r.termId.toString() : 'no-term';
    const compositeKey = `${yearKey}_${subjKey}_${termKey}`;

    if (seenKeys.has(compositeKey)) continue;
    seenKeys.add(compositeKey);

    // 1. Check if record has detailed classesAttended and totalClassesHeld
    const hasDetailedCounts = typeof r.classesAttended === 'number' &&
      typeof r.totalClassesHeld === 'number' &&
      !isNaN(r.classesAttended) &&
      !isNaN(r.totalClassesHeld) &&
      r.totalClassesHeld > 0 &&
      r.classesAttended >= 0;

    if (hasDetailedCounts) {
      totalAttended += r.classesAttended;
      totalHeld += r.totalClassesHeld;
      hasValidDetailedCount = true;
    } else if (typeof r.attendancePercentage === 'number' && !isNaN(r.attendancePercentage) && r.attendancePercentage >= 0 && r.attendancePercentage <= 100) {
      // Fallback for legacy records that only store attendancePercentage directly
      percentageSum += r.attendancePercentage;
      percentageCount++;
    }
  }

  if (hasValidDetailedCount && totalHeld > 0) {
    const rawPct = (totalAttended / totalHeld) * 100;
    const finalPct = Math.min(100, Math.max(0, Math.round(rawPct * 10) / 10));
    return {
      attendancePercentage: finalPct,
      classesAttended: totalAttended,
      totalClassesHeld: totalHeld,
      hasData: true
    };
  }

  if (percentageCount > 0) {
    const finalPct = Math.min(100, Math.max(0, Math.round((percentageSum / percentageCount) * 10) / 10));
    return {
      attendancePercentage: finalPct,
      classesAttended: 0,
      totalClassesHeld: 0,
      hasData: true
    };
  }

  return {
    attendancePercentage: null,
    classesAttended: 0,
    totalClassesHeld: 0,
    hasData: false
  };
}

/**
 * Calculate assessment performance percentage for a set of academic records
 * Deduplicates by subject and term/year
 * 
 * @param {Array} records - Array of AcademicRecord documents
 * @returns {Object} { assessmentScore, hasData }
 */
function calculateAssessmentFromRecords(records) {
  if (!records || records.length === 0) {
    return { assessmentScore: null, hasData: false };
  }

  const sorted = [...records].sort((a, b) =>
    new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );

  const seenKeys = new Set();
  let totalMarksObtained = 0;
  let totalMarksPossible = 0;
  let validCount = 0;

  for (const r of sorted) {
    const yearKey = r.academicYear ? (r.academicYear._id || r.academicYear).toString() : 'no-yr';
    const subjKey = r.subject ? (r.subject._id || r.subject).toString() : 'no-subj';
    const termKey = r.termId ? r.termId.toString() : 'no-term';
    const compositeKey = `${yearKey}_${subjKey}_${termKey}`;

    if (seenKeys.has(compositeKey)) continue;

    const hasValidMarks = typeof r.marksObtained === 'number' &&
      typeof r.totalMarks === 'number' &&
      !isNaN(r.marksObtained) &&
      !isNaN(r.totalMarks) &&
      r.totalMarks > 0 &&
      r.marksObtained >= 0;

    if (hasValidMarks) {
      seenKeys.add(compositeKey);
      totalMarksObtained += r.marksObtained;
      totalMarksPossible += r.totalMarks;
      validCount++;
    }
  }

  if (validCount > 0 && totalMarksPossible > 0) {
    const score = Math.min(100, Math.max(0, Math.round((totalMarksObtained / totalMarksPossible) * 100 * 10) / 10));
    return { assessmentScore: score, hasData: true };
  }

  return { assessmentScore: null, hasData: false };
}

/**
 * Calculate transparent, explainable rule-based Risk Score (0 - 100)
 * 
 * Score Range:
 * - 0 - 33: Low Risk
 * - 34 - 66: Medium Risk
 * - 67 - 100: High Risk
 * 
 * Inputs: Attendance Percentage and Assessment Score Percentage
 */
function calculateExplainableRiskScore(attendancePercentage, assessmentScore) {
  const hasAttendance = typeof attendancePercentage === 'number' && !isNaN(attendancePercentage);
  const hasAssessment = typeof assessmentScore === 'number' && !isNaN(assessmentScore);

  if (!hasAttendance && !hasAssessment) {
    return {
      score: null,
      riskLevel: null,
      factors: ['Insufficient academic and attendance data'],
      hasData: false
    };
  }

  const factors = [];
  let attendanceRiskPoints = null;
  let assessmentRiskPoints = null;

  // 1. Attendance component (0 - 50 points)
  if (hasAttendance) {
    if (attendancePercentage >= 85) {
      attendanceRiskPoints = 0;
      factors.push(`Consistent attendance record (${attendancePercentage}%)`);
    } else if (attendancePercentage >= 75) {
      attendanceRiskPoints = 15;
      factors.push(`Acceptable attendance above minimum requirement (${attendancePercentage}%)`);
    } else if (attendancePercentage >= 65) {
      attendanceRiskPoints = 35;
      factors.push(`Attendance warning: below institutional 75% threshold (${attendancePercentage}%)`);
    } else {
      attendanceRiskPoints = 50;
      factors.push(`Critical attendance alert: severely low attendance (${attendancePercentage}%)`);
    }
  }

  // 2. Assessment component (0 - 50 points)
  if (hasAssessment) {
    if (assessmentScore >= 75) {
      assessmentRiskPoints = 0;
      factors.push(`Strong academic assessment performance (${assessmentScore}%)`);
    } else if (assessmentScore >= 60) {
      assessmentRiskPoints = 15;
      factors.push(`Satisfactory academic performance (${assessmentScore}%)`);
    } else if (assessmentScore >= 45) {
      assessmentRiskPoints = 35;
      factors.push(`Academic risk: performance below course average (${assessmentScore}%)`);
    } else {
      assessmentRiskPoints = 50;
      factors.push(`High academic vulnerability: assessment scores below passing standard (${assessmentScore}%)`);
    }
  }

  // 3. Combined score computation (0 - 100)
  let rawScore = 0;
  if (hasAttendance && hasAssessment) {
    rawScore = attendanceRiskPoints + assessmentRiskPoints;
  } else if (hasAttendance) {
    rawScore = attendanceRiskPoints * 2;
  } else if (hasAssessment) {
    rawScore = assessmentRiskPoints * 2;
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  let riskLevel = 'low';
  if (finalScore > 66) {
    riskLevel = 'high';
  } else if (finalScore > 33) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    score: finalScore,
    riskLevel,
    factors,
    hasData: true
  };
}

/**
 * Fully recalculate attendance and risk for a student and sync RiskPrediction in DB
 * 
 * @param {ObjectId|string} studentId
 * @param {ObjectId|string} institutionId
 * @returns {Promise<Object>} Updated metrics
 */
async function syncStudentMetricsAndRisk(studentId, institutionId) {
  if (!studentId || !institutionId) return null;

  const records = await AcademicRecord.find({
    student: studentId,
    institution: institutionId
  });

  const { attendancePercentage, classesAttended, totalClassesHeld, hasData: hasAttData } =
    calculateAttendanceFromRecords(records);
  const { assessmentScore, hasData: hasScoreData } = calculateAssessmentFromRecords(records);

  const riskResult = calculateExplainableRiskScore(attendancePercentage, assessmentScore);

  // Sync RiskPrediction document so analytics charts & dashboards reflect updated score
  if (riskResult.hasData) {
    await RiskPrediction.findOneAndUpdate(
      { student: studentId, institution: institutionId },
      {
        institution: institutionId,
        student: studentId,
        score: riskResult.score,
        riskLevel: riskResult.riskLevel,
        factors: riskResult.factors,
        predictionDate: new Date()
      },
      { upsert: true, new: true }
    );
  }

  return {
    attendancePercentage,
    classesAttended,
    totalClassesHeld,
    assessmentScore,
    riskScore: riskResult.score,
    riskLevel: riskResult.riskLevel,
    riskFactors: riskResult.factors,
    hasData: hasAttData || hasScoreData
  };
}

module.exports = {
  calculateAttendanceFromRecords,
  calculateAssessmentFromRecords,
  calculateExplainableRiskScore,
  syncStudentMetricsAndRisk
};
