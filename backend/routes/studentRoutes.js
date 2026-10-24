const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole, requirePasswordChanged, requireInstitution } = require('../middleware/auth');
const StudentProfile = require('../models/StudentProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const AcademicRecord = require('../models/AcademicRecord');

const Notification = require('../models/Notification');

const router = express.Router();

// Middleware applied to ALL student routes
router.use(requireAuth, requireRole('student'), requirePasswordChanged, requireInstitution);

/**
 * @route   GET /api/student/dashboard
 * @desc    Get student's profile, academic group details, inherited curriculum assignments, and records
 */
router.get('/dashboard', async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;

    // Find student profile belonging to current user
    const student = await StudentProfile.findOne({
      user: req.currentUser._id,
      institution: institutionId
    }).populate('classRef');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student profile record not found.'
      });
    }

    let assignments = [];
    if (student.classRef) {
      // Inherit group assignments automatically
      assignments = await TeachingAssignment.find({
        classRef: student.classRef._id,
        institution: institutionId,
        isActive: true
      })
        .populate('subject', 'name code department description subjectType credits semester academicYear isActive')
        .populate({
          path: 'teacher',
          select: 'teacherId department designation personalInfo professionalInfo user',
          populate: {
            path: 'user',
            select: 'name email isActive'
          }
        });
    }

    // Historical academic records preserved
    const academicRecords = await AcademicRecord.find({
      student: student._id,
      institution: institutionId
    })
      .populate('subject', 'name code')
      .populate('academicYear', 'year')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        studentId: student.studentId,
        name: req.currentUser.name || student.personalInfo?.name || '',
        email: student.personalInfo?.email || '',
        phone: student.personalInfo?.phone || '',
        dateOfBirth: student.personalInfo?.dateOfBirth,
        address: student.personalInfo?.address || '',
        course: student.course,
        department: student.department,
        academicYear: student.academicYear,
        semester: student.semester,
        section: student.section,
        batch: student.batch || '',
        isActive: req.currentUser.isActive,
        createdAt: student.createdAt,
        group: student.classRef ? {
          _id: student.classRef._id,
          name: student.classRef.name,
          course: student.classRef.course,
          department: student.classRef.department,
          academicYear: student.classRef.academicYear,
          semester: student.classRef.semester,
          section: student.classRef.section
        } : null
      },
      institution: {
        _id: req.currentUser.institution._id,
        name: req.currentUser.institution.name,
        code: req.currentUser.institution.code,
        logoUrl: req.currentUser.institution.logoUrl || ''
      },
      assignments,
      assignmentCount: assignments.length,
      assignmentsPending: !student.classRef || assignments.length === 0,
      academicRecords
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load student dashboard information.'
    });
  }
});

/**
 * @route   GET /api/student/profile
 * @desc    Get authenticated student's profile
 */
router.get('/profile', async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const student = await StudentProfile.findOne({
      user: req.currentUser._id,
      institution: institutionId
    }).populate('classRef');

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student profile not found.' });
    }

    return res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        studentId: student.studentId,
        userId: req.currentUser.userId,
        name: req.currentUser.name || student.personalInfo?.name || '',
        email: student.personalInfo?.email || req.currentUser.email || '',
        phone: student.personalInfo?.phone || '',
        dateOfBirth: student.personalInfo?.dateOfBirth,
        address: student.personalInfo?.address || '',
        course: student.course,
        department: student.department,
        academicYear: student.academicYear,
        semester: student.semester,
        section: student.section,
        batch: student.batch || '',
        role: req.currentUser.role,
        isActive: req.currentUser.isActive,
        createdAt: student.createdAt,
        classRef: student.classRef ? {
          _id: student.classRef._id,
          name: student.classRef.name,
          course: student.classRef.course,
          department: student.classRef.department,
          academicYear: student.classRef.academicYear,
          semester: student.classRef.semester,
          section: student.classRef.section
        } : null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load profile.' });
  }
});

/**
 * @route   PUT /api/student/profile
 * @desc    Update editable personal info for current student
 */
router.put('/profile', async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const { phone, address } = req.body;

    const student = await StudentProfile.findOne({
      user: req.currentUser._id,
      institution: institutionId
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student profile not found.' });
    }

    if (!student.personalInfo) student.personalInfo = {};
    if (phone !== undefined) student.personalInfo.phone = String(phone).trim();
    if (address !== undefined) student.personalInfo.address = String(address).trim();

    await student.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      student: {
        _id: student._id,
        studentId: student.studentId,
        userId: req.currentUser.userId,
        name: req.currentUser.name || student.personalInfo?.name || '',
        email: student.personalInfo?.email || req.currentUser.email || '',
        phone: student.personalInfo?.phone || '',
        dateOfBirth: student.personalInfo?.dateOfBirth,
        address: student.personalInfo?.address || '',
        course: student.course,
        department: student.department,
        academicYear: student.academicYear,
        semester: student.semester,
        section: student.section,
        batch: student.batch || '',
        role: req.currentUser.role,
        isActive: req.currentUser.isActive,
        createdAt: student.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

/**
 * @route   GET /api/student/notifications
 * @desc    Get notifications for currently logged in student
 */
router.get('/notifications', async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const notifications = await Notification.find({
      institution: institutionId,
      recipient: req.currentUser._id,
      isDismissed: { $ne: true }
    }).sort({ createdAt: -1 }).limit(50);

    const unreadCount = await Notification.countDocuments({
      institution: institutionId,
      recipient: req.currentUser._id,
      isRead: false,
      isDismissed: { $ne: true }
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Student notifications error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load notifications.' });
  }
});

/**
 * @route   PATCH /api/student/notifications/:id/read
 * @desc    Mark a notification as read
 */
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.currentUser._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    return res.status(200).json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to mark notification as read.' });
  }
});

/**
 * @route   PATCH /api/student/notifications/mark-all-read
 * @desc    Mark all student notifications as read
 */
router.patch('/notifications/mark-all-read', async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.currentUser._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to mark all notifications as read.' });
  }
});

module.exports = router;
