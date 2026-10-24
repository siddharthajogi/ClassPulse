const User = require('../models/User');

const getSessionCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
});

/**
 * Middleware to require an active authenticated session
 */
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.'
      });
    }

    const user = await User.findById(req.session.userId).populate('institution');

    if (!user) {
      if (req.session) req.session.destroy(() => {});
      res.clearCookie('connect.sid', getSessionCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'User account no longer exists.'
      });
    }

    if (!user.isActive) {
      if (req.session) req.session.destroy(() => {});
      res.clearCookie('connect.sid', getSessionCookieOptions());
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact administration.'
      });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to authenticate session.'
    });
  }
};

/**
 * Middleware factory to enforce role-based authorization
 * @param {string|string[]} roles - Allowed role(s)
 */
const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowed.includes(req.currentUser.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Insufficient permissions for this resource.'
      });
    }

    next();
  };
};

/**
 * Middleware ensuring user has resolved their initial temporary password requirement
 */
const requirePasswordChanged = (req, res, next) => {
  if (!req.currentUser) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
  }

  if (req.currentUser.mustChangePassword) {
    return res.status(403).json({
      success: false,
      mustChangePassword: true,
      error: 'Initial password change required before accessing this resource.'
    });
  }

  next();
};

/**
 * Middleware ensuring user has a valid institution assigned (for multi-tenant isolation)
 */
const requireInstitution = (req, res, next) => {
  if (!req.currentUser) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.currentUser.role === 'superadmin') {
    return next();
  }

  if (!req.currentUser.institution) {
    return res.status(403).json({
      success: false,
      error: 'Account configuration error: No institution assigned.'
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireRole,
  requirePasswordChanged,
  requireInstitution
};
