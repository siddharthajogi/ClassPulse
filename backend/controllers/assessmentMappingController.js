const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const SubjectConcept = require('../models/SubjectConcept');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');
const StudentProfile = require('../models/StudentProfile');
const AcademicYear = require('../models/AcademicYear');
const AcademicRecord = require('../models/AcademicRecord');

/**
 * Helper to resolve teacher profile and verify authorization for a subject
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
 * Helper to compute assessment mapping statistics
 */
function computeAssessmentStats(assessment) {
  const totalQuestions = assessment.questions ? assessment.questions.length : 0;
  let mappedQuestions = 0;

  if (totalQuestions > 0) {
    mappedQuestions = assessment.questions.filter(
      q => q.concepts && q.concepts.length > 0
    ).length;
  }

  const unmappedQuestions = totalQuestions - mappedQuestions;
  const completionPercentage = totalQuestions > 0
    ? Math.round((mappedQuestions / totalQuestions) * 100)
    : 0;

  const totalMaxMarks = assessment.questions && assessment.questions.length > 0
    ? assessment.questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0)
    : (assessment.totalMarks || 0);

  const studentScoresCount = assessment.studentScores ? assessment.studentScores.length : 0;
  const hasStudentEvidence = studentScoresCount > 0;

  return {
    totalQuestions,
    mappedQuestions,
    unmappedQuestions,
    completionPercentage,
    totalMaxMarks,
    hasStudentEvidence,
    studentScoresCount
  };
}

/**
 * @route   GET /api/teacher/knowledge-gaps/assessments
 * @desc    Get all assessments for an assigned subject and scope with mapping statistics
 * @access  Private (Teacher)
 */
exports.getAssessments = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { subjectId, classId, academicYear, semester } = req.query;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        error: 'subjectId query parameter is required to view assessments.'
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

    // Build query for assessments
    const query = {
      institution: institutionId,
      subject: subjectId,
      isActive: true
    };

    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      // Include assessments matching class or global for this subject
      query.$or = [{ classRef: classId }, { classRef: null }, { classRef: { $exists: false } }];
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    if (semester) {
      query.semester = semester;
    }

    const assessments = await Assessment.find(query)
      .populate('subject', 'name code department semester academicYear')
      .populate('classRef', 'name section course department academicYear semester')
      .populate({
        path: 'questions.concepts',
        select: '_id name code difficultyLevel orderIndex isActive',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 });

    const formatted = assessments.map(a => {
      const stats = computeAssessmentStats(a);
      return {
        _id: a._id,
        title: a.title,
        description: a.description,
        assessmentType: a.assessmentType,
        academicYear: a.academicYear,
        semester: a.semester,
        assessmentDate: a.assessmentDate,
        totalMarks: a.totalMarks || stats.totalMaxMarks,
        subject: a.subject,
        classRef: a.classRef,
        questionsCount: stats.totalQuestions,
        stats,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      assessments: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('getAssessments error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve assessments.'
    });
  }
};

/**
 * @route   GET /api/teacher/knowledge-gaps/assessments/:id
 * @desc    Get detailed assessment data with questions, mapped concepts, and evidence status
 * @access  Private (Teacher)
 */
exports.getAssessmentById = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assessment ID format.'
      });
    }

    const assessment = await Assessment.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    })
      .populate('subject', 'name code department semester academicYear')
      .populate('classRef', 'name section course department academicYear semester')
      .populate({
        path: 'questions.concepts',
        select: '_id name code difficultyLevel orderIndex isActive',
        match: { isActive: true }
      });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found.'
      });
    }

    // Verify teacher authorization for this assessment's subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, assessment.subject._id);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    const stats = computeAssessmentStats(assessment);

    // Format questions with mapping status & score indicators
    const questions = assessment.questions.map(q => {
      const activeConcepts = (q.concepts || []).filter(c => c && c.isActive !== false);
      const scoresForQuestion = (assessment.studentScores || []).filter(
        s => s.questionId.toString() === q._id.toString()
      );

      return {
        _id: q._id,
        questionNumber: q.questionNumber,
        text: q.text,
        maxMarks: q.maxMarks,
        concepts: activeConcepts,
        conceptsCount: activeConcepts.length,
        isMapped: activeConcepts.length > 0,
        recordedScoresCount: scoresForQuestion.length,
        hasScores: scoresForQuestion.length > 0
      };
    });

    return res.status(200).json({
      success: true,
      assessment: {
        _id: assessment._id,
        title: assessment.title,
        description: assessment.description,
        assessmentType: assessment.assessmentType,
        academicYear: assessment.academicYear,
        semester: assessment.semester,
        assessmentDate: assessment.assessmentDate,
        totalMarks: assessment.totalMarks || stats.totalMaxMarks,
        subject: assessment.subject,
        classRef: assessment.classRef,
        questions,
        stats,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt
      }
    });
  } catch (error) {
    console.error('getAssessmentById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve assessment details.'
    });
  }
};

/**
 * @route   POST /api/teacher/knowledge-gaps/assessments
 * @desc    Create a new assessment with question-level records and concept mappings
 * @access  Private (Teacher)
 */
exports.createAssessment = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const {
      title,
      description,
      subjectId,
      classId,
      assessmentType,
      academicYear,
      semester,
      assessmentDate,
      totalMarks,
      questions
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Assessment title is required.'
      });
    }

    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        error: 'A valid subjectId is required.'
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

    // If classId is provided, verify it belongs to institution
    let validClassId = null;
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid classId format.'
        });
      }
      const cls = await Class.findOne({ _id: classId, institution: institutionId });
      if (!cls) {
        return res.status(404).json({
          success: false,
          error: 'Specified section/class was not found in this institution.'
        });
      }
      validClassId = cls._id;
    }

    // Validate questions and concept mappings
    const formattedQuestions = [];
    if (Array.isArray(questions) && questions.length > 0) {
      // Gather all referenced concept IDs across all questions
      const allConceptIds = [];
      questions.forEach(q => {
        if (Array.isArray(q.concepts)) {
          q.concepts.forEach(cId => {
            if (cId && mongoose.Types.ObjectId.isValid(cId)) {
              allConceptIds.push(new mongoose.Types.ObjectId(cId));
            }
          });
        }
      });

      // Verify all concepts exist, belong to this institution, AND belong to this subject
      if (allConceptIds.length > 0) {
        const matchingConcepts = await SubjectConcept.find({
          _id: { $in: allConceptIds },
          institution: institutionId,
          isActive: true
        });

        const conceptMap = new Map();
        matchingConcepts.forEach(c => conceptMap.set(c._id.toString(), c));

        for (const cId of allConceptIds) {
          const strId = cId.toString();
          const concept = conceptMap.get(strId);
          if (!concept) {
            return res.status(400).json({
              success: false,
              error: `Concept ID ${strId} does not exist or has been deleted.`
            });
          }
          if (concept.subject.toString() !== subjectId.toString()) {
            return res.status(400).json({
              success: false,
              error: `Concept "${concept.name}" belongs to a different subject and cannot be mapped to this assessment.`
            });
          }
        }
      }

      // Build validated questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = (q.questionNumber || `Q${i + 1}`).trim();
        const maxM = Number(q.maxMarks);

        if (isNaN(maxM) || maxM <= 0) {
          return res.status(400).json({
            success: false,
            error: `Question ${qNum} has invalid maximum marks (${q.maxMarks}). Max marks must be greater than 0.`
          });
        }

        const validConcepts = Array.isArray(q.concepts)
          ? q.concepts.filter(cId => cId && mongoose.Types.ObjectId.isValid(cId))
          : [];

        // Deduplicate concept IDs for the same question
        const uniqueConcepts = [...new Set(validConcepts.map(String))];

        formattedQuestions.push({
          questionNumber: qNum,
          text: (q.text || '').trim(),
          maxMarks: maxM,
          concepts: uniqueConcepts
        });
      }
    }

    const calculatedTotalMarks = formattedQuestions.length > 0
      ? formattedQuestions.reduce((sum, q) => sum + q.maxMarks, 0)
      : (Number(totalMarks) || 0);

    const assessment = await Assessment.create({
      institution: institutionId,
      title: title.trim(),
      description: (description || '').trim(),
      subject: subjectId,
      classRef: validClassId,
      teachingAssignment: authCheck.assignment._id,
      assessmentType: assessmentType || 'Continuous Assessment',
      academicYear: academicYear || authCheck.assignment.academicYear || '',
      semester: semester || '',
      assessmentDate: assessmentDate ? new Date(assessmentDate) : undefined,
      totalMarks: calculatedTotalMarks,
      questions: formattedQuestions,
      createdBy: userId,
      lastUpdatedBy: userId,
      isActive: true
    });

    const populated = await Assessment.findById(assessment._id)
      .populate('subject', 'name code department')
      .populate('classRef', 'name section')
      .populate({
        path: 'questions.concepts',
        select: '_id name code difficultyLevel orderIndex'
      });

    const stats = computeAssessmentStats(populated);

    return res.status(201).json({
      success: true,
      message: 'Assessment created successfully.',
      assessment: populated,
      stats
    });
  } catch (error) {
    console.error('createAssessment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create assessment.'
    });
  }
};

/**
 * @route   PUT /api/teacher/knowledge-gaps/assessments/:id/questions/:questionId/mapping
 * @desc    Update concept mappings for a specific question with subject compatibility validation
 * @access  Private (Teacher)
 */
exports.updateQuestionMapping = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id, questionId } = req.params;
    const { concepts } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assessment ID or question ID format.'
      });
    }

    if (!Array.isArray(concepts)) {
      return res.status(400).json({
        success: false,
        error: 'concepts field must be an array of concept IDs.'
      });
    }

    const assessment = await Assessment.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found.'
      });
    }

    // Verify teacher authorization for this assessment's subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, assessment.subject);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    const question = assessment.questions.id(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found in this assessment.'
      });
    }

    // Validate that all concept IDs exist, belong to this institution, AND belong to the assessment's subject
    const cleanConceptIds = concepts.filter(c => c && mongoose.Types.ObjectId.isValid(c));
    const uniqueConceptIds = [...new Set(cleanConceptIds.map(String))];

    if (uniqueConceptIds.length > 0) {
      const dbConcepts = await SubjectConcept.find({
        _id: { $in: uniqueConceptIds },
        institution: institutionId,
        isActive: true
      });

      const dbMap = new Map();
      dbConcepts.forEach(c => dbMap.set(c._id.toString(), c));

      for (const cId of uniqueConceptIds) {
        const concept = dbMap.get(cId);
        if (!concept) {
          return res.status(400).json({
            success: false,
            error: `Concept ID ${cId} does not exist or has been deleted.`
          });
        }
        if (concept.subject.toString() !== assessment.subject.toString()) {
          return res.status(400).json({
            success: false,
            error: `Concept "${concept.name}" does not belong to the assessment's subject. Incompatible concept mapping rejected.`
          });
        }
      }
    }

    // Apply updated concept mapping
    question.concepts = uniqueConceptIds;
    assessment.lastUpdatedBy = userId;
    await assessment.save();

    // Reload with populated concepts
    const updatedAssessment = await Assessment.findById(assessment._id)
      .populate({
        path: 'questions.concepts',
        select: '_id name code difficultyLevel orderIndex isActive'
      });

    const updatedQuestion = updatedAssessment.questions.id(questionId);
    const stats = computeAssessmentStats(updatedAssessment);

    return res.status(200).json({
      success: true,
      message: 'Question concept mapping updated successfully.',
      question: {
        _id: updatedQuestion._id,
        questionNumber: updatedQuestion.questionNumber,
        text: updatedQuestion.text,
        maxMarks: updatedQuestion.maxMarks,
        concepts: updatedQuestion.concepts,
        isMapped: updatedQuestion.concepts && updatedQuestion.concepts.length > 0
      },
      stats
    });
  } catch (error) {
    console.error('updateQuestionMapping error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update question concept mapping.'
    });
  }
};

/**
 * @route   PUT /api/teacher/knowledge-gaps/assessments/:id/questions
 * @desc    Save/replace all questions and concept mappings for an assessment
 * @access  Private (Teacher)
 */
exports.saveAssessmentQuestions = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;
    const { questions } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assessment ID format.'
      });
    }

    if (!Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'questions field must be an array.'
      });
    }

    const assessment = await Assessment.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found.'
      });
    }

    // Verify teacher authorization for this assessment's subject
    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, assessment.subject);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    // Collect all concept IDs across questions
    const allConceptIds = [];
    questions.forEach(q => {
      if (Array.isArray(q.concepts)) {
        q.concepts.forEach(c => {
          const cId = typeof c === 'object' && c._id ? c._id : c;
          if (cId && mongoose.Types.ObjectId.isValid(cId)) {
            allConceptIds.push(new mongoose.Types.ObjectId(cId));
          }
        });
      }
    });

    // Validate concept compatibility
    if (allConceptIds.length > 0) {
      const dbConcepts = await SubjectConcept.find({
        _id: { $in: allConceptIds },
        institution: institutionId,
        isActive: true
      });

      const dbMap = new Map();
      dbConcepts.forEach(c => dbMap.set(c._id.toString(), c));

      for (const cId of allConceptIds) {
        const strId = cId.toString();
        const concept = dbMap.get(strId);
        if (!concept) {
          return res.status(400).json({
            success: false,
            error: `Concept ID ${strId} does not exist or has been deleted.`
          });
        }
        if (concept.subject.toString() !== assessment.subject.toString()) {
          return res.status(400).json({
            success: false,
            error: `Concept "${concept.name}" belongs to another subject and cannot be mapped to this assessment.`
          });
        }
      }
    }

    // Format new questions array
    const formattedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = (q.questionNumber || `Q${i + 1}`).trim();
      const maxM = Number(q.maxMarks);

      if (isNaN(maxM) || maxM <= 0) {
        return res.status(400).json({
          success: false,
          error: `Question ${qNum} has invalid maximum marks (${q.maxMarks}). Must be greater than 0.`
        });
      }

      const validConcepts = Array.isArray(q.concepts)
        ? q.concepts
            .map(c => (typeof c === 'object' && c._id ? c._id.toString() : String(c)))
            .filter(cId => mongoose.Types.ObjectId.isValid(cId))
        : [];

      formattedQuestions.push({
        _id: q._id && mongoose.Types.ObjectId.isValid(q._id) ? q._id : new mongoose.Types.ObjectId(),
        questionNumber: qNum,
        text: (q.text || '').trim(),
        maxMarks: maxM,
        concepts: [...new Set(validConcepts)]
      });
    }

    assessment.questions = formattedQuestions;
    assessment.totalMarks = formattedQuestions.reduce((sum, q) => sum + q.maxMarks, 0);
    assessment.lastUpdatedBy = userId;
    await assessment.save();

    const populated = await Assessment.findById(assessment._id)
      .populate('subject', 'name code department')
      .populate('classRef', 'name section')
      .populate({
        path: 'questions.concepts',
        select: '_id name code difficultyLevel orderIndex isActive'
      });

    const stats = computeAssessmentStats(populated);

    return res.status(200).json({
      success: true,
      message: 'Assessment questions and mappings saved successfully.',
      assessment: populated,
      stats
    });
  } catch (error) {
    console.error('saveAssessmentQuestions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save assessment questions.'
    });
  }
};

/**
 * @route   DELETE /api/teacher/knowledge-gaps/assessments/:id
 * @desc    Soft-delete an assessment
 * @access  Private (Teacher)
 */
exports.deleteAssessment = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assessment ID format.'
      });
    }

    const assessment = await Assessment.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found.'
      });
    }

    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, assessment.subject);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    assessment.isActive = false;
    assessment.lastUpdatedBy = userId;
    await assessment.save();

    return res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully.'
    });
  } catch (error) {
    console.error('deleteAssessment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete assessment.'
    });
  }
};

/**
 * @route   GET /api/teacher/knowledge-gaps/assessments/:id/scores
 * @desc    Get student-level question scores for an assessment or report evidence unavailability
 * @access  Private (Teacher)
 */
exports.getStudentQuestionScores = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assessment ID format.'
      });
    }

    const assessment = await Assessment.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    }).populate('classRef', 'name section department');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found.'
      });
    }

    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, assessment.subject);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    // Fetch students enrolled in the assessment's class (if classRef is defined)
    let students = [];
    if (assessment.classRef) {
      students = await StudentProfile.find({
        institution: institutionId,
        classRef: assessment.classRef._id
      })
        .populate('user', 'name email')
        .sort({ studentId: 1 });
    }

    const studentScores = assessment.studentScores || [];
    const hasEvidence = studentScores.length > 0;

    return res.status(200).json({
      success: true,
      assessmentId: assessment._id,
      hasEvidence,
      totalScoresRecorded: studentScores.length,
      evidenceMessage: hasEvidence
        ? `Found ${studentScores.length} question-level student score records.`
        : 'No question-level student responses recorded yet. Student-level evidence is currently unavailable for this assessment.',
      scores: studentScores,
      students: students.map(s => ({
        _id: s._id,
        rollNumber: s.studentId || '',
        name: s.user?.name || 'Student ' + s.studentId,
        email: s.user?.email || ''
      })),
      questions: assessment.questions.map(q => ({
        _id: q._id,
        questionNumber: q.questionNumber,
        maxMarks: q.maxMarks
      }))
    });
  } catch (error) {
    console.error('getStudentQuestionScores error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve student question scores.'
    });
  }
};

/**
 * @route   POST /api/teacher/knowledge-gaps/assessments/:id/scores
 * @desc    Record question-level marks for students with strict validation (0 <= marks <= maxMarks)
 * @access  Private (Teacher)
 */
exports.recordStudentQuestionScores = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const userId = req.currentUser._id;
    const { id } = req.params;
    const { scores } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assessment ID format.'
      });
    }

    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'scores array is required and must contain at least one score entry.'
      });
    }

    const assessment = await Assessment.findOne({
      _id: id,
      institution: institutionId,
      isActive: true
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found.'
      });
    }

    const authCheck = await resolveTeacherAndVerifySubject(userId, institutionId, assessment.subject);
    if (!authCheck.authorized) {
      return res.status(authCheck.status).json({
        success: false,
        error: authCheck.error
      });
    }

    // Map questions for quick maxMarks lookup
    const questionMap = new Map();
    assessment.questions.forEach(q => {
      questionMap.set(q._id.toString(), q);
    });

    // Validate every score entry
    const validScoresToUpsert = [];
    for (let i = 0; i < scores.length; i++) {
      const entry = scores[i];
      const { studentId, questionId, marksObtained } = entry;

      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({
          success: false,
          error: `Invalid studentId at index ${i}.`
        });
      }

      if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({
          success: false,
          error: `Invalid questionId at index ${i}.`
        });
      }

      const qDoc = questionMap.get(questionId.toString());
      if (!qDoc) {
        return res.status(400).json({
          success: false,
          error: `Question ID ${questionId} does not belong to this assessment.`
        });
      }

      const marks = Number(marksObtained);
      if (isNaN(marks)) {
        return res.status(400).json({
          success: false,
          error: `Marks obtained for question ${qDoc.questionNumber} must be a valid number.`
        });
      }

      if (marks < 0) {
        return res.status(400).json({
          success: false,
          error: `Marks obtained for question ${qDoc.questionNumber} cannot be negative (${marks}).`
        });
      }

      if (marks > qDoc.maxMarks) {
        return res.status(400).json({
          success: false,
          error: `Marks obtained for question ${qDoc.questionNumber} (${marks}) exceeds maximum marks (${qDoc.maxMarks}).`
        });
      }

      validScoresToUpsert.push({
        student: new mongoose.Types.ObjectId(studentId),
        questionId: new mongoose.Types.ObjectId(questionId),
        marksObtained: marks
      });
    }

    // Merge/upsert scores in assessment.studentScores
    const existingScores = assessment.studentScores || [];
    validScoresToUpsert.forEach(newScore => {
      const existingIdx = existingScores.findIndex(
        s => s.student.toString() === newScore.student.toString() &&
             s.questionId.toString() === newScore.questionId.toString()
      );

      if (existingIdx >= 0) {
        existingScores[existingIdx].marksObtained = newScore.marksObtained;
      } else {
        existingScores.push(newScore);
      }
    });

    assessment.studentScores = existingScores;
    assessment.lastUpdatedBy = userId;
    await assessment.save();

    const stats = computeAssessmentStats(assessment);

    return res.status(200).json({
      success: true,
      message: `Successfully recorded ${validScoresToUpsert.length} student question scores.`,
      scoresCount: assessment.studentScores.length,
      stats
    });
  } catch (error) {
    console.error('recordStudentQuestionScores error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record student question scores.'
    });
  }
};
