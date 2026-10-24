const express = require('express');
const { requireAuth, requireRole, requirePasswordChanged, requireInstitution } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Middleware applied to ALL admin routes
router.use(requireAuth, requireRole('admin'), requirePasswordChanged, requireInstitution);

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard statistics
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

/**
 * @route   GET /api/admin/accounts
 * @desc    Get canonical list of active accounts across all roles (Admin, Teacher, Student)
 */
router.get('/accounts', adminController.getActiveAccounts);
router.get('/users/active', adminController.getActiveAccounts);

// Dashboard Analytics
router.get('/dashboard/enrollment-analytics', adminController.getEnrollmentAnalytics);
router.get('/dashboard/performance-analytics', adminController.getPerformanceAnalytics);
router.get('/dashboard/risk-overview', adminController.getRiskOverview);
router.get('/dashboard/recent-activity', adminController.getRecentActivity);

// Institution Setup & Settings
router.get('/institution/status', adminController.getInstitutionSetupStatus);
router.post('/institution/setup', adminController.setupInstitution);
router.put('/institution/settings', adminController.updateInstitutionSettings);
router.post('/institution/upload-logo', adminController.uploadInstitutionLogo);

// Administrator User Preferences & Profile
router.get('/preferences', adminController.getPreferences);
router.put('/preferences', adminController.updatePreferences);
router.get('/profile', adminController.getAdminProfile);
router.put('/profile', adminController.updateAdminProfile);

// Notifications Management
router.get('/notifications', adminController.getNotifications);
router.get('/notifications/unread-count', adminController.getUnreadNotificationCount);
router.patch('/notifications/mark-all-read', adminController.markAllNotificationsAsRead);
router.patch('/notifications/bulk-read', adminController.bulkMarkNotificationsAsRead);
router.post('/notifications/bulk-read', adminController.bulkMarkNotificationsAsRead);
router.post('/notifications/bulk-delete', adminController.bulkDeleteNotifications);
router.delete('/notifications/bulk-delete', adminController.bulkDeleteNotifications);
router.patch('/notifications/:id/read', adminController.markNotificationAsRead);
router.delete('/notifications/:id', adminController.deleteNotification);

// Academic Years
router.get('/academic-years', adminController.getAcademicYears);
router.post('/academic-years', adminController.createAcademicYear);
router.put('/academic-years/:id/activate', adminController.activateAcademicYear);

/**
 * @route   POST /api/admin/students
 * @desc    Create a new student account
 */
router.post('/students', adminController.createStudent);

/**
 * @route   GET /api/admin/students
 * @desc    Get list of students
 */
router.get('/students', adminController.getStudents);

/**
 * @route   GET /api/admin/students/:id
 * @desc    Get student profile by ID
 */
router.get('/students/:id', adminController.getStudentById);

/**
 * @route   PUT /api/admin/students/:id
 * @desc    Update a student profile
 */
router.put('/students/:id', adminController.updateStudent);

/**
 * @route   GET /api/admin/classes
 * @desc    Get list of classes/groups with enrollment and assignment stats
 */
router.get('/classes', adminController.getClasses);

/**
 * @route   POST /api/admin/classes
 * @desc    Create a new section/class under an academic year and department
 */
router.post('/classes', adminController.createClass);

/**
 * @route   POST /api/admin/classes/reconcile-students
 * @desc    Safely reconcile students without valid classRef against configured sections
 */
router.post('/classes/reconcile-students', adminController.reconcileStudentGroups);

/**
 * @route   GET /api/admin/classes/:id
 * @desc    Get class/group details including enrolled students and assigned subjects
 */
router.get('/classes/:id', adminController.getClassById);

/**
 * @route   PUT /api/admin/classes/:id
 * @desc    Update section details
 */
router.put('/classes/:id', adminController.updateClass);

/**
 * @route   PUT /api/admin/departments/batch-update
 * @desc    Batch update department across sections
 */
router.put('/departments/batch-update', adminController.updateDepartmentBatch);

/**
 * @route   PUT /api/admin/classes/:id/assignments
 * @desc    Update group-level subject and teacher assignments
 */
router.put('/classes/:id/assignments', adminController.updateClassAssignments);

/**
 * @route   GET /api/admin/departments
 * @desc    Get list of departments
 */
router.get('/departments', adminController.getDepartments);

/**
 * @route   GET /api/admin/subjects
 * @desc    Get list of subjects
 */
router.get('/subjects', adminController.getSubjects);

/**
 * @route   POST /api/admin/subjects
 * @desc    Create a new subject
 */
router.post('/subjects', adminController.createSubject);

/**
 * @route   PUT /api/admin/subjects/:id
 * @desc    Update a subject
 */
router.put('/subjects/:id', adminController.updateSubject);

/**
 * @route   PATCH /api/admin/subjects/:id/status
 * @desc    Update subject status (activate/deactivate)
 */
router.patch('/subjects/:id/status', adminController.updateSubjectStatus);

/**
 * @route   POST /api/admin/teachers
 * @desc    Create a new teacher account
 */
router.post('/teachers', adminController.createTeacher);

/**
 * @route   GET /api/admin/teachers
 * @desc    Get list of teachers
 */
router.get('/teachers', adminController.getTeachers);

/**
 * @route   GET /api/admin/teachers/:id
 * @desc    Get teacher profile by ID
 */
router.get('/teachers/:id', adminController.getTeacherById);

/**
 * @route   PUT /api/admin/teachers/:id
 * @desc    Update a teacher profile
 */
router.put('/teachers/:id', adminController.updateTeacher);

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Update user status (activate/deactivate)
 */
router.patch('/users/:id/status', adminController.updateUserStatus);

/**
 * @route   POST /api/admin/users/:id/reset-password
 * @desc    Admin resets user password
 */
router.post('/users/:id/reset-password', adminController.adminResetPassword);

/**
 * @route   DELETE /api/admin/students/:id
 * @desc    Permanently delete a student record
 */
router.delete('/students/:id', adminController.deleteStudent);

/**
 * @route   GET /api/admin/teachers/:id/dependencies
 * @desc    Get teacher assignments and academic dependencies before deletion
 */
router.get('/teachers/:id/dependencies', adminController.getTeacherDependencies);

/**
 * @route   DELETE /api/admin/teachers/:id
 * @desc    Permanently delete a teacher record with dependency resolution
 */
router.delete('/teachers/:id', adminController.deleteTeacher);

/**
 * @route   DELETE /api/admin/subjects/:id
 * @desc    Permanently delete a subject
 */
router.delete('/subjects/:id', adminController.deleteSubject);

/**
 * @route   DELETE /api/admin/academic-years/:id
 * @desc    Permanently delete an academic year
 */
router.delete('/academic-years/:id', adminController.deleteAcademicYear);

/**
 * @route   DELETE /api/admin/classes/:id
 * @desc    Permanently delete a class
 */
router.delete('/classes/:id', adminController.deleteClass);

/**
 * @route   DELETE /api/admin/departments/:departmentName
 * @desc    Permanently delete a department with dependency checks
 */
router.delete('/departments/:departmentName', adminController.deleteDepartment);

module.exports = router;
