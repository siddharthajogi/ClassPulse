const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Class = require('../models/Class');
const TeachingAssignment = require('../models/TeachingAssignment');
const RiskPrediction = require('../models/RiskPrediction');
const AcademicRecord = require('../models/AcademicRecord');

/**
 * Checks whether a notification should be created based on the user's notification preferences.
 * Critical alerts (warning, error, security_system) are NEVER suppressed.
 */
const shouldDeliverNotification = (user, category, severity, metadata = {}) => {
  // Critical alerts must always be delivered
  if (severity === 'warning' || severity === 'error' || category === 'security_system') {
    return true;
  }

  const prefs = user?.preferences?.notifications;
  if (!prefs) return true;

  // Master in-app toggle
  if (prefs.inApp === false) {
    return false;
  }

  // Category specific preferences
  if ((category === 'students' || category === 'teachers') && prefs.accountActivity === false) {
    return false;
  }

  if (category === 'student_risks' && prefs.riskAlerts === false) {
    return false;
  }

  if (category === 'academics') {
    if (metadata.isRisk && prefs.riskAlerts === false) {
      return false;
    }
    if (metadata.isAcademicRecord && prefs.academicRecords === false) {
      return false;
    }
  }

  return true;
};

/**
 * Create a single notification for a specific recipient administrator.
 * Includes deduplication support via eventKey.
 */
const createNotification = async ({
  institutionId,
  recipientId,
  title,
  message,
  category,
  severity = 'info',
  relatedEntityType,
  relatedEntityId,
  destinationUrl,
  metadata = {},
  eventKey
}) => {
  try {
    const resolvedInstId = institutionId?._id || institutionId;
    const resolvedRecipientId = recipientId?._id || recipientId;

    if (!resolvedInstId || !resolvedRecipientId || !title || !message || !category) {
      console.warn('[NotificationService] Missing required fields for notification');
      return null;
    }

    // 1. Deduplication check if eventKey is provided (within last 24h or unread)
    if (eventKey) {
      const existing = await Notification.findOne({
        institution: resolvedInstId,
        recipient: resolvedRecipientId,
        eventKey,
        isDismissed: false
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Preference evaluation
    const recipientUser = await User.findById(resolvedRecipientId).select('preferences isActive role');
    if (!recipientUser || !recipientUser.isActive || recipientUser.role !== 'admin') {
      return null;
    }

    const deliver = shouldDeliverNotification(recipientUser, category, severity, metadata);
    if (!deliver) {
      return null;
    }

    // 3. Persist notification
    const notification = await Notification.create({
      institution: resolvedInstId,
      recipient: resolvedRecipientId,
      title: title.trim(),
      message: message.trim(),
      category,
      severity,
      relatedEntityType,
      relatedEntityId,
      destinationUrl,
      metadata,
      eventKey
    });

    return notification;
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error.message);
    return null;
  }
};

/**
 * Dispatch notification to all active administrators of an institution.
 */
const notifyAllAdmins = async (institutionId, notificationData) => {
  try {
    const resolvedInstId = institutionId?._id || institutionId;
    if (!resolvedInstId) return [];
    const admins = await User.find({
      institution: resolvedInstId,
      role: 'admin',
      isActive: true
    }).select('_id');

    const results = [];
    for (const admin of admins) {
      const created = await createNotification({
        ...notificationData,
        institutionId: resolvedInstId,
        recipientId: admin._id
      });
      if (created) results.push(created);
    }
    return results;
  } catch (error) {
    console.error('[NotificationService] Error notifying admins:', error.message);
    return [];
  }
};

/**
 * Evaluates real-time academic and system conditions from actual MongoDB data
 * and generates appropriate notifications without duplication.
 */
const syncSystemAndAcademicAlerts = async (institutionId, adminId) => {
  try {
    const resolvedInstId = institutionId?._id || institutionId;
    const resolvedAdminId = adminId?._id || adminId;
    if (!resolvedInstId || !resolvedAdminId) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Check for high-risk students in RiskPrediction (actual ML / analytics data)
    const highRiskDocs = await RiskPrediction.find({
      institution: institutionId,
      riskLevel: 'high'
    }).populate({
      path: 'student',
      populate: { path: 'user', select: 'name' }
    });

    if (highRiskDocs && highRiskDocs.length > 0) {
      const count = highRiskDocs.length;
      await createNotification({
        institutionId,
        recipientId: adminId,
        title: `Academic Risk Alert: ${count} High-Risk Student${count > 1 ? 's' : ''}`,
        message: `${count} student${count > 1 ? 's have' : ' has'} been flagged by Risk Analytics as requiring academic support and intervention.`,
        category: 'student_risks',
        severity: 'warning',
        destinationUrl: '/admin/risk-analytics',
        metadata: { isRisk: true, count },
        eventKey: `RISK_ALERT_HIGH_${count}_${todayStr}`
      });
    }

    // 2. Check for sections with incomplete teacher assignments
    const unassignedFaculty = await TeachingAssignment.find({
      institution: institutionId,
      teacher: null,
      isActive: true
    }).populate('classRef', 'department section academicYear semester');

    if (unassignedFaculty && unassignedFaculty.length > 0) {
      const classMap = new Map();
      unassignedFaculty.forEach(a => {
        if (a.classRef) {
          const key = `${a.classRef.department} - Sec ${a.classRef.section}`;
          classMap.set(key, (classMap.get(key) || 0) + 1);
        }
      });

      if (classMap.size > 0) {
        const sectionsList = Array.from(classMap.keys()).slice(0, 3).join(', ');
        const totalMissing = unassignedFaculty.length;
        await createNotification({
          institutionId,
          recipientId: adminId,
          title: 'Incomplete Faculty Assignments Detected',
          message: `${totalMissing} subject assignment${totalMissing > 1 ? 's have' : ' has'} no teacher designated in ${sectionsList}${classMap.size > 3 ? ' and other sections' : ''}.`,
          category: 'teachers',
          severity: 'warning',
          destinationUrl: '/admin/classes',
          metadata: { missingTeacherCount: totalMissing },
          eventKey: `FACULTY_ASSIGNMENT_MISSING_${totalMissing}_${todayStr}`
        });
      }
    }

    // 3. Check for empty sections (no subjects assigned at all)
    const allSections = await Class.find({ institution: institutionId });
    if (allSections && allSections.length > 0) {
      const assignedClassIds = await TeachingAssignment.distinct('classRef', { institution: institutionId, isActive: true });
      const unassignedSections = allSections.filter(s => !assignedClassIds.some(cId => cId.equals(s._id)));

      if (unassignedSections.length > 0) {
        const sampleNames = unassignedSections.slice(0, 2).map(s => `${s.department} Sec ${s.section}`).join(', ');
        await createNotification({
          institutionId,
          recipientId: adminId,
          title: 'Curriculum Warning: Sections Without Subjects',
          message: `${unassignedSections.length} section${unassignedSections.length > 1 ? 's have' : ' has'} no curriculum subjects configured (${sampleNames}${unassignedSections.length > 2 ? '...' : ''}).`,
          category: 'departments_sections',
          severity: 'info',
          destinationUrl: '/admin/classes',
          metadata: { unassignedSectionCount: unassignedSections.length },
          eventKey: `SECTIONS_WITHOUT_SUBJECTS_${unassignedSections.length}_${todayStr}`
        });
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error syncing system alerts:', error.message);
  }
};

module.exports = {
  createNotification,
  notifyAllAdmins,
  syncSystemAndAcademicAlerts
};
