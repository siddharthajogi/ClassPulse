const mongoose = require('mongoose');
const SubjectConcept = require('../models/SubjectConcept');
const Assessment = require('../models/Assessment');
const TeachingAssignment = require('../models/TeachingAssignment');
const TeacherProfile = require('../models/TeacherProfile');
const StudentProfile = require('../models/StudentProfile');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const KnowledgeGapFollowUp = require('../models/KnowledgeGapFollowUp');

/**
 * Stage 3 Diagnosis Configuration
 * Centralized, explainable thresholds for knowledge-gap classification
 */
const DIAGNOSIS_CONFIG = {
  NEEDS_ATTENTION_THRESHOLD: 50, // Scores below 50% indicate critical gaps
  DEVELOPING_THRESHOLD: 75,       // Scores from 50% up to 74% indicate developing grasp
  ON_TRACK_THRESHOLD: 75,         // Scores 75% and above indicate on track
  MIN_EVIDENCE_QUESTIONS: 1,      // Minimum question-level evidence required to classify
  LABELS: {
    NEEDS_ATTENTION: 'Needs Attention',
    DEVELOPING: 'Developing',
    ON_TRACK: 'On Track',
    INSUFFICIENT_DATA: 'Insufficient Data'
  }
};

/**
 * Helper to verify teacher authorization for a subject
 */
async function resolveTeacherAndVerifySubject(userId, institutionId, subjectId) {
  const teacherProfile = await TeacherProfile.findOne({
    user: userId,
    institution: institutionId
  });

  if (!teacherProfile) {
    return { authorized: false, status: 403, error: 'Teacher profile not found for this account.' };
  }

  const assignment = await TeachingAssignment.findOne({
    institution: institutionId,
    teacher: teacherProfile._id,
    subject: subjectId,
    isActive: true
  });

  if (!assignment) {
    return {
      authorized: false,
      status: 403,
      error: 'Access denied: You are not assigned to teach this subject in this institution.'
    };
  }

  return { authorized: true, teacherProfile, assignment };
}

/**
 * Evaluates performance and assigns an evidence-based classification
 */
function classifyConceptPerformance(earnedMarks, possibleMarks, evidenceCount) {
  if (evidenceCount < DIAGNOSIS_CONFIG.MIN_EVIDENCE_QUESTIONS || possibleMarks <= 0) {
    return {
      classification: 'INSUFFICIENT_DATA',
      label: DIAGNOSIS_CONFIG.LABELS.INSUFFICIENT_DATA,
      percentage: null,
      reason: 'No question-level scores recorded yet for this concept. Classification is deferred until assessment evidence is available.'
    };
  }

  const rawPct = (earnedMarks / possibleMarks) * 100;
  const percentage = Math.round(rawPct * 10) / 10; // 1 decimal place

  if (percentage < DIAGNOSIS_CONFIG.NEEDS_ATTENTION_THRESHOLD) {
    return {
      classification: 'NEEDS_ATTENTION',
      label: DIAGNOSIS_CONFIG.LABELS.NEEDS_ATTENTION,
      percentage,
      reason: `Performance (${percentage}%) is below the ${DIAGNOSIS_CONFIG.NEEDS_ATTENTION_THRESHOLD}% threshold based on ${evidenceCount} question${evidenceCount > 1 ? 's' : ''} (${earnedMarks}/${possibleMarks} marks).`
    };
  } else if (percentage < DIAGNOSIS_CONFIG.DEVELOPING_THRESHOLD) {
    return {
      classification: 'DEVELOPING',
      label: DIAGNOSIS_CONFIG.LABELS.DEVELOPING,
      percentage,
      reason: `Performance (${percentage}%) indicates developing understanding (${DIAGNOSIS_CONFIG.NEEDS_ATTENTION_THRESHOLD}%–${DIAGNOSIS_CONFIG.DEVELOPING_THRESHOLD - 1}%) based on ${evidenceCount} question${evidenceCount > 1 ? 's' : ''} (${earnedMarks}/${possibleMarks} marks).`
    };
  } else {
    return {
      classification: 'ON_TRACK',
      label: DIAGNOSIS_CONFIG.LABELS.ON_TRACK,
      percentage,
      reason: `Performance (${percentage}%) meets or exceeds the ${DIAGNOSIS_CONFIG.ON_TRACK_THRESHOLD}% proficiency criteria based on ${evidenceCount} question${evidenceCount > 1 ? 's' : ''} (${earnedMarks}/${possibleMarks} marks).`
    };
  }
}

/**
 * @route   GET /api/teacher/knowledge-gaps/diagnosis
 * @desc    Generate explainable evidence-based knowledge-gap diagnosis across students and concepts
 * @access  Private (Teacher)
 */
exports.getKnowledgeGapDiagnosis = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { subjectId, classId, studentId, academicYear, semester } = req.query;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        error: 'subjectId query parameter is required.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subjectId format.'
      });
    }

    // Verify teacher authorization for this subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, subjectId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    // 1. Fetch Subject Concepts with their prerequisites (Stage 1 relationships)
    const concepts = await SubjectConcept.find({
      institution: institutionId,
      subject: subjectId,
      isActive: true
    })
      .populate('prerequisites', '_id name difficultyLevel orderIndex')
      .sort({ orderIndex: 1, name: 1 });

    const conceptMap = new Map();
    concepts.forEach(c => conceptMap.set(c._id.toString(), c));

    // 2. Fetch Assessments for this subject and scope first (so we can include all students with recorded scores)
    const assessmentQuery = {
      institution: institutionId,
      subject: subjectId,
      isActive: true
    };
    if (academicYear) assessmentQuery.academicYear = academicYear;
    if (semester) assessmentQuery.semester = semester;

    const assessments = await Assessment.find(assessmentQuery);

    // Collect all student IDs who have recorded scores in these assessments
    const scoredStudentIds = [];
    assessments.forEach(asm => {
      (asm.studentScores || []).forEach(s => {
        if (s.student) scoredStudentIds.push(s.student);
      });
    });

    // 3. Resolve target Classes / Sections
    let targetClassIds = [];
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      targetClassIds = [new mongoose.Types.ObjectId(classId)];
    } else {
      // Find all classes assigned to this teacher for this subject
      const activeAssignments = await TeachingAssignment.find({
        institution: institutionId,
        teacher: authCheck.teacherProfile._id,
        subject: subjectId,
        isActive: true
      });
      targetClassIds = activeAssignments.map(a => a.classRef).filter(Boolean);
    }

    // 4. Fetch Students in target scope
    const studentQuery = {
      institution: institutionId
    };

    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      studentQuery._id = new mongoose.Types.ObjectId(studentId);
    } else if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      studentQuery.classRef = new mongoose.Types.ObjectId(classId);
    } else {
      const orClauses = [];
      if (targetClassIds.length > 0) {
        orClauses.push({ classRef: { $in: targetClassIds } });
      }
      if (scoredStudentIds.length > 0) {
        orClauses.push({ _id: { $in: scoredStudentIds } });
      }

      if (orClauses.length > 0) {
        studentQuery.$or = orClauses;
      }
    }

    const students = await StudentProfile.find(studentQuery)
      .populate('user', 'name email')
      .populate('classRef', 'name section department')
      .sort({ studentId: 1 });

    // 5. Fetch Teacher Follow-Up Notes for this subject
    const followUps = await KnowledgeGapFollowUp.find({
      institution: institutionId,
      subject: subjectId
    }).populate('updatedBy', 'name');

    const followUpMap = new Map();
    followUps.forEach(f => {
      const key = `${f.student.toString()}_${f.concept.toString()}`;
      followUpMap.set(key, {
        reviewStatus: f.reviewStatus,
        notes: f.notes,
        updatedAt: f.updatedAt,
        updatedBy: f.updatedBy?.name || 'Teacher'
      });
    });

    // 6. Build Question-to-Concept Inverted Index from valid assessments
    // conceptId -> [ { assessment, question } ]
    const conceptQuestionsIndex = new Map();
    concepts.forEach(c => conceptQuestionsIndex.set(c._id.toString(), []));

    assessments.forEach(asm => {
      (asm.questions || []).forEach(q => {
        (q.concepts || []).forEach(cRef => {
          const cId = cRef.toString();
          if (conceptQuestionsIndex.has(cId)) {
            conceptQuestionsIndex.get(cId).push({
              assessmentId: asm._id.toString(),
              assessmentTitle: asm.title,
              assessmentType: asm.assessmentType,
              assessmentDate: asm.assessmentDate,
              questionId: q._id.toString(),
              questionNumber: q.questionNumber,
              prompt: q.text || '',
              maxMarks: Number(q.maxMarks) || 0,
              studentScores: asm.studentScores || []
            });
          }
        });
      });
    });

    // 7. Core Diagnosis Engine Execution: Calculate Student-Concept Performance
    // matrix: studentId -> conceptId -> evaluationResult
    const studentEvaluations = new Map();
    const allFindings = [];

    students.forEach(student => {
      const sId = student._id.toString();
      studentEvaluations.set(sId, new Map());

      concepts.forEach(concept => {
        const cId = concept._id.toString();
        const mappedQuestions = conceptQuestionsIndex.get(cId) || [];

        let earnedMarks = 0;
        let possibleMarks = 0;
        const evidenceQuestions = [];

        // Track questions to prevent any double-counting
        const processedQuestions = new Set();

        mappedQuestions.forEach(qItem => {
          const uniqueQKey = `${qItem.assessmentId}_${qItem.questionId}`;
          if (processedQuestions.has(uniqueQKey)) return;

          // Find student score in this question
          const scoreRecord = qItem.studentScores.find(
            s => s.student.toString() === sId && s.questionId.toString() === qItem.questionId
          );

          // SAFEGUARD: Do not count missing marks as zero!
          // Only include question in concept calculation if actual score record exists
          if (scoreRecord && typeof scoreRecord.marksObtained === 'number' && scoreRecord.marksObtained >= 0) {
            processedQuestions.add(uniqueQKey);
            const scoredMarks = scoreRecord.marksObtained;
            const maxM = qItem.maxMarks;

            earnedMarks += scoredMarks;
            possibleMarks += maxM;

            const qPct = maxM > 0 ? Math.round((scoredMarks / maxM) * 1000) / 10 : 0;
            evidenceQuestions.push({
              assessmentId: qItem.assessmentId,
              assessmentTitle: qItem.assessmentTitle,
              assessmentType: qItem.assessmentType,
              assessmentDate: qItem.assessmentDate,
              questionId: qItem.questionId,
              questionNumber: qItem.questionNumber,
              prompt: qItem.prompt,
              marksEarned: scoredMarks,
              maxMarks: maxM,
              percentage: qPct
            });
          }
        });

        const evidenceCount = evidenceQuestions.length;
        const classificationResult = classifyConceptPerformance(earnedMarks, possibleMarks, evidenceCount);

        const evaluation = {
          studentId: sId,
          conceptId: cId,
          conceptName: concept.name,
          difficultyLevel: concept.difficultyLevel,
          orderIndex: concept.orderIndex,
          earnedMarks: Math.round(earnedMarks * 10) / 10,
          possibleMarks: Math.round(possibleMarks * 10) / 10,
          evidenceCount,
          evidenceQuestions,
          performance: classificationResult.percentage,
          classification: classificationResult.classification,
          classificationLabel: classificationResult.label,
          reason: classificationResult.reason,
          prerequisites: concept.prerequisites || []
        };

        studentEvaluations.get(sId).set(cId, evaluation);
      });
    });

    // 8. Enrich Findings with Prerequisite Analysis and Follow-Up Notes
    const conceptsNeedingAttentionSet = new Set();
    const studentsWithGapsSet = new Set();
    let totalScoreSum = 0;
    let totalScoredCount = 0;

    students.forEach(student => {
      const sId = student._id.toString();
      const sMap = studentEvaluations.get(sId);

      concepts.forEach(concept => {
        const cId = concept._id.toString();
        const evalItem = sMap.get(cId);

        // Analyze prerequisites for this student-concept
        const prerequisiteFindings = (evalItem.prerequisites || []).map(prereq => {
          const prereqId = prereq._id.toString();
          const prereqEval = sMap.get(prereqId);

          let prereqStatus = 'UNKNOWN';
          let prereqScore = null;
          let prereqNote = 'Prerequisite concept has no recorded evidence.';

          if (prereqEval) {
            prereqStatus = prereqEval.classification;
            prereqScore = prereqEval.performance;
            if (prereqEval.classification === 'NEEDS_ATTENTION') {
              prereqNote = `Prerequisite also needs attention (${prereqEval.performance}%). May represent a foundational bottleneck.`;
            } else if (prereqEval.classification === 'DEVELOPING') {
              prereqNote = `Prerequisite has developing mastery (${prereqEval.performance}%).`;
            } else if (prereqEval.classification === 'ON_TRACK') {
              prereqNote = `Prerequisite is mastered (${prereqEval.performance}%). Deficit may be localized to current concept.`;
            }
          }

          return {
            prerequisiteId: prereqId,
            name: prereq.name,
            difficultyLevel: prereq.difficultyLevel,
            classification: prereqStatus,
            performance: prereqScore,
            note: prereqNote
          };
        });

        // Retrieve saved teacher follow-up note
        const followUpKey = `${sId}_${cId}`;
        const followUp = followUpMap.get(followUpKey) || {
          reviewStatus: 'Needs Review',
          notes: '',
          updatedAt: null,
          updatedBy: null
        };

        const enrichedFinding = {
          student: {
            _id: student._id,
            rollNumber: student.studentId || '',
            name: student.user?.name || `Student ${student.studentId}`,
            email: student.user?.email || '',
            section: student.classRef?.name || student.section || ''
          },
          concept: {
            _id: concept._id,
            name: concept.name,
            difficultyLevel: concept.difficultyLevel,
            description: concept.description,
            orderIndex: concept.orderIndex,
            prerequisitesCount: (concept.prerequisites || []).length
          },
          performance: evalItem.performance,
          classification: evalItem.classification,
          classificationLabel: evalItem.classificationLabel,
          earnedMarks: evalItem.earnedMarks,
          possibleMarks: evalItem.possibleMarks,
          evidenceCount: evalItem.evidenceCount,
          evidenceQuestions: evalItem.evidenceQuestions,
          reason: evalItem.reason,
          prerequisiteFindings,
          hasPrerequisiteGap: prerequisiteFindings.some(p => p.classification === 'NEEDS_ATTENTION'),
          followUp
        };

        allFindings.push(enrichedFinding);

        if (evalItem.classification === 'NEEDS_ATTENTION') {
          conceptsNeedingAttentionSet.add(cId);
          studentsWithGapsSet.add(sId);
        }

        if (evalItem.performance !== null) {
          totalScoreSum += evalItem.performance;
          totalScoredCount++;
        }
      });
    });

    // 9. Summary Statistics
    // Count concepts with zero evidence across the entire analyzed student cohort
    const zeroEvidenceConcepts = concepts.filter(c => {
      const qList = conceptQuestionsIndex.get(c._id.toString()) || [];
      const totalRecordedScoresForConcept = qList.reduce(
        (sum, q) => sum + (q.studentScores ? q.studentScores.length : 0), 0
      );
      return totalRecordedScoresForConcept === 0;
    });

    const summary = {
      totalStudentsAnalyzed: students.length,
      conceptsNeedingAttentionCount: conceptsNeedingAttentionSet.size,
      studentsWithGapsCount: studentsWithGapsSet.size,
      insufficientEvidenceConceptsCount: zeroEvidenceConcepts.length,
      classAveragePerformance: totalScoredCount > 0 ? Math.round(totalScoreSum / totalScoredCount) : null,
      totalFindings: allFindings.length
    };

    // 10. Heatmap Data Grid Construction
    // rows: students, columns: concepts
    const heatmapGrid = students.map(student => {
      const sId = student._id.toString();
      const sMap = studentEvaluations.get(sId);

      const conceptCells = concepts.map(concept => {
        const cId = concept._id.toString();
        const item = sMap.get(cId);

        return {
          conceptId: cId,
          conceptName: concept.name,
          performance: item.performance,
          classification: item.classification,
          classificationLabel: item.classificationLabel,
          evidenceCount: item.evidenceCount,
          earnedMarks: item.earnedMarks,
          possibleMarks: item.possibleMarks
        };
      });

      return {
        student: {
          _id: student._id,
          rollNumber: student.studentId || '',
          name: student.user?.name || `Student ${student.studentId}`,
          section: student.classRef?.name || student.section || ''
        },
        cells: conceptCells
      };
    });

    return res.status(200).json({
      success: true,
      summary,
      heatmap: {
        concepts: concepts.map(c => ({
          _id: c._id,
          name: c.name,
          difficultyLevel: c.difficultyLevel,
          orderIndex: c.orderIndex,
          prerequisitesCount: (c.prerequisites || []).length
        })),
        students: heatmapGrid
      },
      findings: allFindings,
      config: {
        needsAttentionThreshold: DIAGNOSIS_CONFIG.NEEDS_ATTENTION_THRESHOLD,
        developingThreshold: DIAGNOSIS_CONFIG.DEVELOPING_THRESHOLD,
        onTrackThreshold: DIAGNOSIS_CONFIG.ON_TRACK_THRESHOLD,
        minEvidenceQuestions: DIAGNOSIS_CONFIG.MIN_EVIDENCE_QUESTIONS
      }
    });

  } catch (error) {
    console.error('getKnowledgeGapDiagnosis error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate knowledge-gap diagnosis.'
    });
  }
};

/**
 * @route   GET /api/teacher/knowledge-gaps/diagnosis/students/:studentId/concepts/:conceptId
 * @desc    Get detailed explainable evidence and prerequisite audit for a specific student and concept
 * @access  Private (Teacher)
 */
exports.getStudentConceptDetail = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { studentId, conceptId } = req.params;
    const { subjectId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(conceptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid studentId or conceptId format.'
      });
    }

    const concept = await SubjectConcept.findOne({
      _id: conceptId,
      institution: institutionId,
      isActive: true
    }).populate('prerequisites', '_id name difficultyLevel description');

    if (!concept) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found.'
      });
    }

    const targetSubjectId = subjectId || concept.subject;

    // Verify teacher authorization
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, targetSubjectId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    const student = await StudentProfile.findOne({
      _id: studentId,
      institution: institutionId
    })
      .populate('user', 'name email')
      .populate('classRef', 'name section department');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student record not found.'
      });
    }

    // Fetch assessments containing questions for this concept
    const assessments = await Assessment.find({
      institution: institutionId,
      subject: targetSubjectId,
      isActive: true,
      'questions.concepts': concept._id
    });

    const evidenceQuestions = [];
    let earnedMarks = 0;
    let possibleMarks = 0;

    assessments.forEach(asm => {
      (asm.questions || []).forEach(q => {
        const isMapped = (q.concepts || []).some(c => c.toString() === conceptId.toString());
        if (isMapped) {
          const score = (asm.studentScores || []).find(
            s => s.student.toString() === studentId.toString() && s.questionId.toString() === q._id.toString()
          );

          if (score && typeof score.marksObtained === 'number' && score.marksObtained >= 0) {
            const mEarned = score.marksObtained;
            const mMax = Number(q.maxMarks) || 0;
            earnedMarks += mEarned;
            possibleMarks += mMax;

            evidenceQuestions.push({
              assessmentId: asm._id,
              assessmentTitle: asm.title,
              assessmentType: asm.assessmentType,
              assessmentDate: asm.assessmentDate,
              questionNumber: q.questionNumber,
              prompt: q.text || '',
              marksEarned: mEarned,
              maxMarks: mMax,
              percentage: mMax > 0 ? Math.round((mEarned / mMax) * 1000) / 10 : 0
            });
          }
        }
      });
    });

    const classificationResult = classifyConceptPerformance(earnedMarks, possibleMarks, evidenceQuestions.length);

    // Fetch prerequisite performance for this student
    const prereqDetails = [];
    for (const prereq of concept.prerequisites || []) {
      const prereqAssessments = await Assessment.find({
        institution: institutionId,
        subject: targetSubjectId,
        isActive: true,
        'questions.concepts': prereq._id
      });

      let pEarned = 0;
      let pPossible = 0;
      let pCount = 0;

      prereqAssessments.forEach(asm => {
        (asm.questions || []).forEach(q => {
          const isMapped = (q.concepts || []).some(c => c.toString() === prereq._id.toString());
          if (isMapped) {
            const score = (asm.studentScores || []).find(
              s => s.student.toString() === studentId.toString() && s.questionId.toString() === q._id.toString()
            );
            if (score && typeof score.marksObtained === 'number' && score.marksObtained >= 0) {
              pEarned += score.marksObtained;
              pPossible += Number(q.maxMarks) || 0;
              pCount++;
            }
          }
        });
      });

      const pClass = classifyConceptPerformance(pEarned, pPossible, pCount);
      prereqDetails.push({
        _id: prereq._id,
        name: prereq.name,
        difficultyLevel: prereq.difficultyLevel,
        description: prereq.description,
        performance: pClass.percentage,
        classification: pClass.classification,
        classificationLabel: pClass.label,
        evidenceCount: pCount
      });
    }

    // Retrieve Follow-Up Note
    const followUp = await KnowledgeGapFollowUp.findOne({
      institution: institutionId,
      subject: targetSubjectId,
      student: studentId,
      concept: conceptId
    }).populate('updatedBy', 'name');

    return res.status(200).json({
      success: true,
      detail: {
        student: {
          _id: student._id,
          rollNumber: student.studentId || '',
          name: student.user?.name || `Student ${student.studentId}`,
          email: student.user?.email || '',
          section: student.classRef?.name || student.section || ''
        },
        concept: {
          _id: concept._id,
          name: concept.name,
          difficultyLevel: concept.difficultyLevel,
          description: concept.description,
          orderIndex: concept.orderIndex
        },
        performance: classificationResult.percentage,
        classification: classificationResult.classification,
        classificationLabel: classificationResult.label,
        earnedMarks,
        possibleMarks,
        evidenceCount: evidenceQuestions.length,
        evidenceQuestions,
        reason: classificationResult.reason,
        prerequisites: prereqDetails,
        followUp: followUp ? {
          reviewStatus: followUp.reviewStatus,
          notes: followUp.notes,
          updatedAt: followUp.updatedAt,
          updatedBy: followUp.updatedBy?.name || 'Teacher'
        } : {
          reviewStatus: 'Needs Review',
          notes: '',
          updatedAt: null,
          updatedBy: null
        }
      }
    });

  } catch (error) {
    console.error('getStudentConceptDetail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve student concept detail.'
    });
  }
};

/**
 * @route   POST /api/teacher/knowledge-gaps/diagnosis/follow-up
 * @desc    Save teacher follow-up review status and notes for a student-concept knowledge gap
 * @access  Private (Teacher)
 */
exports.saveFollowUpNote = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { studentId, conceptId, subjectId, reviewStatus, notes } = req.body;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, error: 'Valid studentId is required.' });
    }
    if (!conceptId || !mongoose.Types.ObjectId.isValid(conceptId)) {
      return res.status(400).json({ success: false, error: 'Valid conceptId is required.' });
    }
    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ success: false, error: 'Valid subjectId is required.' });
    }

    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, subjectId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({ success: false, error: authCheck.error });
    }

    const validStatuses = ['Needs Review', 'Under Review', 'Action Taken', 'Resolved', 'Monitoring'];
    const statusToSave = validStatuses.includes(reviewStatus) ? reviewStatus : 'Needs Review';

    const followUp = await KnowledgeGapFollowUp.findOneAndUpdate(
      {
        institution: institutionId,
        subject: subjectId,
        student: studentId,
        concept: conceptId
      },
      {
        institution: institutionId,
        subject: subjectId,
        student: studentId,
        concept: conceptId,
        reviewStatus: statusToSave,
        notes: (notes || '').trim(),
        updatedBy: userId
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(200).json({
      success: true,
      message: 'Follow-up note and review status saved successfully.',
      followUp: {
        reviewStatus: followUp.reviewStatus,
        notes: followUp.notes,
        updatedAt: followUp.updatedAt
      }
    });

  } catch (error) {
    console.error('saveFollowUpNote error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save follow-up note.'
    });
  }
};
