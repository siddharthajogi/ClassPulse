const express = require('express');
const { requireAuth, requireRole, requirePasswordChanged, requireInstitution } = require('../middleware/auth');
const teacherController = require('../controllers/teacherController');
const conceptController = require('../controllers/conceptController');
const assessmentMappingController = require('../controllers/assessmentMappingController');
const diagnosisController = require('../controllers/diagnosisController');

const router = express.Router();

// Middleware applied to ALL teacher routes:
// Only authenticated users with role 'teacher' in their valid institution who have completed initial password change
router.use(requireAuth, requireRole('teacher'), requirePasswordChanged, requireInstitution);

/**
 * @route   GET /api/teacher/dashboard/analytics
 * @desc    Comprehensive analytics for teacher dashboard (4 summary cards + 3 analytics charts)
 */
router.get('/dashboard/analytics', teacherController.getDashboardAnalytics);

/**
 * @route   GET /api/teacher/dashboard/stats
 * @desc    Alias for dashboard analytics to support flexible frontend consumers
 */
router.get('/dashboard/stats', teacherController.getDashboardAnalytics);

/**
 * @route   GET /api/teacher/risk-analytics
 * @desc    Detailed student risk analytics (EduRiskMonitor adapted) with filters, charts, and risk directory
 */
router.get('/risk-analytics', teacherController.getTeacherRiskAnalytics);

/**
 * @route   GET /api/teacher/subjects
 * @desc    Get all unique subjects assigned to the authenticated teacher with associated sections
 */
router.get('/subjects', teacherController.getMySubjects);

/**
 * @route   GET /api/teacher/classes
 * @desc    Get all assigned departments and sections for the authenticated teacher organized by academic hierarchy
 */
router.get('/classes', teacherController.getMyClasses);

/**
 * @route   GET /api/teacher/classes/:id
 * @desc    Get details and enrolled students roster for an assigned section
 */
router.get('/classes/:id', teacherController.getClassDetails);

/**
 * @route   GET /api/teacher/students
 * @desc    Get all students across assigned sections with attendance & risk score
 */
router.get('/students', teacherController.getTeacherStudents);

/**
 * @route   GET /api/teacher/students/sections/:id
 * @desc    Get details and enrolled students roster for an assigned section in Students navigation
 */
router.get('/students/sections/:id', teacherController.getClassDetails);

/**
 * @route   GET /api/teacher/students/:studentId
 * @desc    Get student profile details and academic records
 */
router.get('/students/:studentId', teacherController.getTeacherStudentDetails);

/**
 * @route   POST /api/teacher/students/:studentId/record
 * @desc    Record or update attendance and assessment marks with automatic risk recalculation
 */
router.post('/students/:studentId/record', teacherController.recordStudentAttendanceAndMarks);

/**
 * @route   GET /api/teacher/knowledge-gaps/filters
 * @desc    Get academic scope filters for knowledge-gap analysis
 */
router.get('/knowledge-gaps/filters', conceptController.getKnowledgeGapFilters);

/**
 * @route   GET /api/teacher/knowledge-gaps/concepts
 * @desc    List all concepts and prerequisites for an assigned subject
 */
router.get('/knowledge-gaps/concepts', conceptController.getConcepts);

/**
 * @route   POST /api/teacher/knowledge-gaps/concepts
 * @desc    Create a concept with validated prerequisites
 */
router.post('/knowledge-gaps/concepts', conceptController.createConcept);

/**
 * @route   PUT /api/teacher/knowledge-gaps/concepts/:id
 * @desc    Update a concept and its prerequisites with cycle prevention
 */
router.put('/knowledge-gaps/concepts/:id', conceptController.updateConcept);

/**
 * @route   DELETE /api/teacher/knowledge-gaps/concepts/:id
 * @desc    Delete a concept safely (prevents deletion if required as prerequisite)
 */
router.delete('/knowledge-gaps/concepts/:id', conceptController.deleteConcept);

/**
 * Stage 2: Assessment Question to Concept Mapping Routes
 */

/**
 * @route   GET /api/teacher/knowledge-gaps/assessments
 * @desc    Get all assessments for an assigned subject with mapping statistics
 */
router.get('/knowledge-gaps/assessments', assessmentMappingController.getAssessments);

/**
 * @route   GET /api/teacher/knowledge-gaps/assessments/:id
 * @desc    Get detailed assessment data with questions, mapped concepts, and evidence status
 */
router.get('/knowledge-gaps/assessments/:id', assessmentMappingController.getAssessmentById);

/**
 * @route   POST /api/teacher/knowledge-gaps/assessments
 * @desc    Create a new assessment with question records and concept mappings
 */
router.post('/knowledge-gaps/assessments', assessmentMappingController.createAssessment);

/**
 * @route   PUT /api/teacher/knowledge-gaps/assessments/:id/questions/:questionId/mapping
 * @desc    Update concept mappings for a specific question with subject compatibility validation
 */
router.put('/knowledge-gaps/assessments/:id/questions/:questionId/mapping', assessmentMappingController.updateQuestionMapping);

/**
 * @route   PUT /api/teacher/knowledge-gaps/assessments/:id/questions
 * @desc    Save/replace all questions and concept mappings for an assessment
 */
router.put('/knowledge-gaps/assessments/:id/questions', assessmentMappingController.saveAssessmentQuestions);

/**
 * @route   DELETE /api/teacher/knowledge-gaps/assessments/:id
 * @desc    Soft delete an assessment
 */
router.delete('/knowledge-gaps/assessments/:id', assessmentMappingController.deleteAssessment);

/**
 * @route   GET /api/teacher/knowledge-gaps/assessments/:id/scores
 * @desc    Get student-level question scores for an assessment or report evidence unavailability
 */
router.get('/knowledge-gaps/assessments/:id/scores', assessmentMappingController.getStudentQuestionScores);

/**
 * @route   POST /api/teacher/knowledge-gaps/assessments/:id/scores
 * @desc    Record question-level marks for students with strict validation (0 <= marks <= maxMarks)
 */
router.post('/knowledge-gaps/assessments/:id/scores', assessmentMappingController.recordStudentQuestionScores);

/**
 * Stage 3: Evidence-Based Knowledge-Gap Diagnosis Routes
 */

/**
 * @route   GET /api/teacher/knowledge-gaps/diagnosis
 * @desc    Get complete knowledge-gap diagnosis across students and concepts with heatmap and findings
 */
router.get('/knowledge-gaps/diagnosis', diagnosisController.getKnowledgeGapDiagnosis);

/**
 * @route   GET /api/teacher/knowledge-gaps/diagnosis/students/:studentId/concepts/:conceptId
 * @desc    Get detailed explainable evidence and prerequisite audit for a specific student-concept
 */
router.get('/knowledge-gaps/diagnosis/students/:studentId/concepts/:conceptId', diagnosisController.getStudentConceptDetail);

/**
 * @route   POST /api/teacher/knowledge-gaps/diagnosis/follow-up
 * @desc    Save teacher review status and follow-up notes for a student-concept gap
 */
router.post('/knowledge-gaps/diagnosis/follow-up', diagnosisController.saveFollowUpNote);

/**
 * @route   GET /api/teacher/profile
 * @desc    Get authenticated teacher's profile details and available departments
 */
router.get('/profile', teacherController.getTeacherProfile);

/**
 * @route   PUT /api/teacher/profile
 * @desc    Update authenticated teacher's profile
 */
router.put('/profile', teacherController.updateTeacherProfile);

module.exports = router;



