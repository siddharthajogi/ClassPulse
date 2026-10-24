const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const { requireAuth } = require('../middleware/auth');
const { notifyAllAdmins, createNotification } = require('../services/notificationService');

const router = express.Router();

const escapeRegex = (str) => (typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');

// In-memory tracker for consecutive failed login attempts
const failedLoginAttempts = new Map();

// Helper to record failed login and notify admins if threshold is met
const recordFailedLogin = async (cleanId) => {
  try {
    if (mongoose.connection.readyState !== 1) return;

    const now = Date.now();
    const entry = failedLoginAttempts.get(cleanId) || { count: 0, lastAttempt: now };
    if (now - entry.lastAttempt > 15 * 60 * 1000) {
      entry.count = 0;
    }
    entry.count += 1;
    entry.lastAttempt = now;
    failedLoginAttempts.set(cleanId, entry);

    if (entry.count >= 3) {
      const targetUser = await User.findOne({ userId: cleanId });
      const instId = targetUser?.institution || (await User.findOne({ role: 'admin' }))?.institution;
      if (instId) {
        const hourKey = new Date().toISOString().slice(0, 13);
        await notifyAllAdmins(instId, {
          title: 'Security Alert: Suspicious Login Attempts',
          message: `${entry.count} consecutive failed login attempts detected for account ID "${cleanId}".`,
          category: 'security_system',
          severity: 'warning',
          destinationUrl: '/admin/activity-logs',
          eventKey: `FAILED_LOGIN_${cleanId}_${hourKey}`
        });
      }
    }
  } catch (err) {
    console.error('[Auth Error Recording Failed Login]:', err.message);
  }
};

// Password Policy: Minimum 8 characters, at least 1 letter, and at least 1 number or special character
const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return hasLetter && hasNumberOrSymbol;
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user against role and credentials
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { userId, password, role } = req.body;

    // 1. Validate inputs
    if (!userId || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Please provide ID, password, and role.'
      });
    }

    const validRoles = ['student', 'teacher', 'admin'];
    const cleanRole = String(role).trim().toLowerCase();
    if (!validRoles.includes(cleanRole)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role selected.'
      });
    }

    // 2. Pre-check database connection availability
    if (mongoose.connection.readyState !== 1) {
      console.error(`[Auth Login Error] Database unavailable (readyState: ${mongoose.connection.readyState})`);
      return res.status(503).json({
        success: false,
        error: 'Database service is temporarily unavailable. Please try again in a few moments.'
      });
    }

    const rawId = String(userId).trim();
    const cleanId = rawId.toLowerCase();

    // 2. Find matching account using existing database models and relationships
    let user = null;

    if (cleanRole === 'teacher') {
      // Step A: First try direct User lookup by userId or email
      user = await User.findOne({
        $or: [
          { userId: cleanId },
          { email: cleanId }
        ]
      });

      // Step B: If not found, lookup via TeacherProfile by teacherId (case-insensitive) or personalInfo.email
      if (!user) {
        const teacherProfile = await TeacherProfile.findOne({
          $or: [
            { teacherId: cleanId },
            { teacherId: rawId },
            { teacherId: new RegExp(`^${escapeRegex(rawId)}$`, 'i') },
            { 'personalInfo.email': cleanId },
            { 'personalInfo.email': rawId }
          ]
        }).populate('user');

        if (teacherProfile && teacherProfile.user) {
          user = teacherProfile.user;
        }
      }
    } else {
      // Student or Admin account lookup
      user = await User.findOne({
        $or: [
          { userId: cleanId },
          { email: cleanId }
        ]
      });
    }

    if (!user) {
      await recordFailedLogin(cleanId);
      // Return 401 for non-existent account without disclosing internal details
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your ID and password.'
      });
    }

    // 3. Verify that the selected login role matches the account's actual role
    if (user.role !== cleanRole) {
      await recordFailedLogin(cleanId);
      return res.status(401).json({
        success: false,
        error: `Selected role (${cleanRole}) does not match this account's registered role.`
      });
    }

    // 4. Verify account is active
    if (!user.isActive) {
      await recordFailedLogin(cleanId);
      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated. Please contact administration.'
      });
    }

    // 5. Verify password securely using bcrypt implementation
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await recordFailedLogin(cleanId);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your ID and password.'
      });
    }

    // Clear failed attempts counter upon successful login
    failedLoginAttempts.delete(cleanId);

    // Ensure teacher institution is attached if available in TeacherProfile
    if (!user.institution && cleanRole === 'teacher') {
      const profile = await TeacherProfile.findOne({ user: user._id });
      if (profile && profile.institution) {
        user.institution = profile.institution;
        await user.save();
      }
    }

    // 6. Establish secure session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.mustChangePassword = user.mustChangePassword;

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Session Save Error]:', err.message);
          return reject(err);
        }
        resolve();
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        userId: user.userId,
        role: user.role,
        name: user.name || '',
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    console.error('[Login Controller Error]:', error.message);

    const isDbError =
      error.name === 'MongooseServerSelectionError' ||
      error.name === 'MongoNetworkError' ||
      error.name === 'MongoTimeoutError' ||
      error.name === 'MongoServerSelectionError' ||
      error.name === 'MongooseError' ||
      error.message?.includes('buffering timed out') ||
      error.message?.includes('topology') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ENOTFOUND') ||
      mongoose.connection.readyState !== 1;

    if (isDbError) {
      return res.status(503).json({
        success: false,
        error: 'Database service is temporarily unavailable. Please try again in a few moments.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred. Please try again.'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated session user
 * @access  Private
 */
router.get('/me', requireAuth, (req, res) => {
  const user = req.currentUser;
  return res.status(200).json({
    success: true,
    user: {
      userId: user.userId,
      role: user.role,
      name: user.name || '',
      mustChangePassword: user.mustChangePassword
    }
  });
});

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = req.currentUser;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password, new password, and confirmation are required.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password and confirmation do not match.'
      });
    }

    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long and contain letters and at least one number or symbol.'
      });
    }

    // Verify current password with bcrypt
    const isCurrentValid = await user.comparePassword(currentPassword);
    if (!isCurrentValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect.'
      });
    }

    // Ensure new password differs from current password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: 'New password cannot be the same as your current password.'
      });
    }

    // Hash new password using bcrypt (10 rounds)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user record
    user.password = hashedPassword;
    user.mustChangePassword = false;
    await user.save();

    if (user.role === 'admin' && user.institution) {
      await createNotification({
        institutionId: user.institution,
        recipientId: user._id,
        title: 'Security Alert: Password Changed',
        message: 'Your administrator account password was successfully updated.',
        category: 'security_system',
        severity: 'info',
        destinationUrl: '/admin/settings'
      });
    }

    // Update session state
    req.session.mustChangePassword = false;
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
      user: {
        userId: user.userId,
        role: user.role,
        name: user.name || '',
        mustChangePassword: false
      }
    });
  } catch (error) {
    console.error('[Change Password Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while changing password.'
    });
  }
});

const getSessionCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
});

/**
 * @route   POST /api/auth/logout
 * @desc    Destroy session and clear cookie
 * @access  Private (or Public)
 */
router.post('/logout', (req, res) => {
  const cookieOptions = getSessionCookieOptions();

  const clearAndRespond = (statusCode = 200, payload = { success: true, message: 'Logged out successfully.' }) => {
    res.clearCookie('connect.sid', cookieOptions);
    return res.status(statusCode).json(payload);
  };

  if (!req.session) {
    return clearAndRespond();
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Error]:', err.message);
      return clearAndRespond(500, {
        success: false,
        error: 'Could not log out. Please try again.'
      });
    }

    return clearAndRespond();
  });
});

module.exports = router;
