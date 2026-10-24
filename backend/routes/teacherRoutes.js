const express = require('express');
const { requireAuth, requireRole, requirePasswordChanged, requireInstitution } = require('../middleware/auth');
const teacherController = require('../controllers/teacherController');

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


