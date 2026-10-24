const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const AuditLog = require('../models/AuditLog');
const Institution = require('../models/Institution');
const AcademicYear = require('../models/AcademicYear');
const AcademicRecord = require('../models/AcademicRecord');
const RiskPrediction = require('../models/RiskPrediction');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Department = require('../models/Department');
const { createNotification, notifyAllAdmins, syncSystemAndAcademicAlerts } = require('../services/notificationService');
const DEPARTMENTS = require('../config/departments');
const { QUALIFICATION_OPTIONS } = require('../config/qualifications');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/logos directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration for college logo
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const cleanExt = ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext) ? ext : '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `college-logo-${uniqueSuffix}${cleanExt}`);
  }
});

const logoFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and WebP images are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const uploadLogo = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter: logoFileFilter
}).single('logo');

const escapeRegex = (str) => typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

// Helper to extract, normalize, and deduplicate qualifications
const normalizeQualifications = (body) => {
  const pInfo = body.professionalInfo || {};
  let list = [];

  if (Array.isArray(pInfo.qualifications)) {
    list = pInfo.qualifications;
  } else if (Array.isArray(body.qualifications)) {
    list = body.qualifications;
  } else if (typeof pInfo.qualifications === 'string' && pInfo.qualifications.trim()) {
    list = pInfo.qualifications.split(',');
  } else if (typeof body.qualifications === 'string' && body.qualifications.trim()) {
    list = body.qualifications.split(',');
  } else if (typeof pInfo.highestQualification === 'string' && pInfo.highestQualification.trim()) {
    list = pInfo.highestQualification.split(',');
  } else if (typeof body.highestQualification === 'string' && body.highestQualification.trim()) {
    list = body.highestQualification.split(',');
  } else if (typeof body.qualification === 'string' && body.qualification.trim()) {
    list = body.qualification.split(',');
  }

  // Also check if custom otherQualification was passed
  const customOther = (pInfo.otherQualification || body.otherQualification || '').trim();
  if (customOther) {
    list.push(customOther);
  }

  const cleaned = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (
        trimmed &&
        !trimmed.toLowerCase().startsWith('select') &&
        trimmed.toLowerCase() !== 'other' &&
        !seen.has(trimmed.toLowerCase())
      ) {
        seen.add(trimmed.toLowerCase());
        cleaned.push(trimmed);
      }
    }
  }
  return cleaned;
};

// Helper to ensure legacy teacher records have normalized qualifications array
const ensureTeacherQualifications = (teacherDoc) => {
  if (!teacherDoc) return teacherDoc;
  const obj = typeof teacherDoc.toObject === 'function' ? teacherDoc.toObject() : { ...teacherDoc };
  if (!obj.professionalInfo) obj.professionalInfo = {};
  if (!Array.isArray(obj.professionalInfo.qualifications) || obj.professionalInfo.qualifications.length === 0) {
    if (obj.professionalInfo.highestQualification && typeof obj.professionalInfo.highestQualification === 'string') {
      obj.professionalInfo.qualifications = obj.professionalInfo.highestQualification
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      obj.professionalInfo.qualifications = [];
    }
  }
  return obj;
};

// Helper to log audit events
const logAudit = async (institutionId, actorId, action, targetResource, resourceModel, metadata = {}) => {
  try {
    await AuditLog.create({ institution: institutionId, actor: actorId, action, targetResource, resourceModel, metadata });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};

const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return hasLetter && hasNumberOrSymbol;
};

const validateEmailFormat = (email) => {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

const validatePhoneFormat = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  // Validates 10-digit phone number with optional +91 or + country prefix
  const regex = /^(?:\+?91[\-\s]?)?[6-9]\d{9}$|^[0-9]{10}$/;
  return regex.test(trimmed);
};

const validateExperience = (exp) => {
  if (exp === undefined || exp === null || exp === '' || String(exp).trim() === '') return false;
  const num = Number(exp);
  return !isNaN(num) && num >= 0 && num <= 60;
};

exports.getDashboardStats = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const totalStudents = await StudentProfile.countDocuments({ institution: institutionId });
    const totalTeachers = await TeacherProfile.countDocuments({ institution: institutionId });

    // Active accounts across all three roles strictly belonging to the active institution:
    // 1. Active student accounts
    const activeStudents = await User.countDocuments({
      role: 'student',
      isActive: true,
      institution: institutionId
    });

    // 2. Active teacher accounts
    const activeTeachers = await User.countDocuments({
      role: 'teacher',
      isActive: true,
      institution: institutionId
    });

    // 3. Active administrator accounts belonging to active institution (counted exactly once)
    const activeAdmins = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      isActive: true,
      institution: institutionId
    });

    // Total active accounts combining active students, teachers, and administrators exactly once
    const activeAccounts = activeStudents + activeTeachers + activeAdmins;

    // Inactive accounts strictly belonging to the active institution
    const inactiveAccounts = await User.countDocuments({
      isActive: false,
      role: { $in: ['student', 'teacher', 'admin', 'superadmin'] },
      institution: institutionId
    });

    // Classes belonging to active institution: total classes and active classes
    const totalClasses = await Class.countDocuments({ institution: institutionId });
    const activeClasses = await Class.countDocuments({ isActive: true, institution: institutionId });

    // Subjects belonging to active institution: total subjects and active subjects
    const totalSubjects = await Subject.countDocuments({ institution: institutionId });
    const activeSubjects = await Subject.countDocuments({ isActive: true, institution: institutionId });

    // Departments belonging to active institution
    const departments = await Department.countDocuments({ institution: institutionId });

    // Fetch active institution and academic year context
    const institution = await Institution.findById(institutionId);
    const activeYear = await AcademicYear.findOne({ isActive: true, institution: institutionId });
    let activeTerm = null;
    if (activeYear && activeYear.terms) {
       activeTerm = activeYear.terms.find(t => t.isActive);
    }

    res.status(200).json({
      success: true,
      stats: { 
        totalStudents, 
        totalTeachers, 
        activeAccounts, 
        activeStudents,
        activeTeachers,
        activeAdmins,
        inactiveAccounts, 
        totalClasses,
        activeClasses,
        totalSubjects,
        activeSubjects,
        departments,
        totalDepartments: departments
      },
      context: {
        institutionName: institution ? institution.name : 'Setup Pending',
        description: institution ? institution.description : '',
        logoUrl: (institution && institution.logoUrl && institution.logoUrl.trim()) ? institution.logoUrl.trim() : null,
        academicYear: activeYear ? activeYear.year : 'Not Set',
        startDate: activeYear ? activeYear.startDate : null,
        currentTerm: activeTerm ? activeTerm.name : 'Not Set',
        lastRefresh: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
};

const ensureDepartmentsForInstitution = async (institutionId) => {
  if (!institutionId) return [];

  let docs = await Department.find({ institution: institutionId }).sort({ name: 1 });

  if (docs.length === 0) {
    const toInsert = DEPARTMENTS.map(d => ({
      institution: institutionId,
      name: d.name,
      code: d.code,
      isActive: true
    }));

    try {
      const classDepts = await Class.distinct('department', { institution: institutionId });
      for (const cDept of classDepts) {
        if (cDept && typeof cDept === 'string' && cDept.trim()) {
          const trimmed = cDept.trim();
          const already = toInsert.some(d =>
            d.name.toLowerCase() === trimmed.toLowerCase() ||
            (d.code && d.code.toLowerCase() === trimmed.toLowerCase())
          );
          if (!already) {
            const words = trimmed.split(/\s+/);
            const code = words.length > 1
              ? words.map(w => w[0]).join('').toUpperCase()
              : trimmed.substring(0, 4).toUpperCase();
            toInsert.push({
              institution: institutionId,
              name: trimmed,
              code,
              isActive: true
            });
          }
        }
      }
    } catch (_) {}

    try {
      await Department.insertMany(toInsert, { ordered: false });
    } catch (_) {}

    docs = await Department.find({ institution: institutionId }).sort({ name: 1 });
  }

  return docs;
};

exports.ensureDepartmentsForInstitution = ensureDepartmentsForInstitution;

exports.getDepartments = async (req, res) => {
  try {
    const institutionId = req.currentUser?.institution?._id || req.currentUser?.institution;
    let departments = [];
    if (institutionId) {
      departments = await ensureDepartmentsForInstitution(institutionId);
    } else {
      departments = await Department.find({ isActive: true }).sort({ name: 1 });
      if (departments.length === 0) {
        departments = DEPARTMENTS.map((d, idx) => ({
          _id: `dept_${idx}_${d.code}`,
          name: d.name,
          code: d.code,
          isActive: true
        }));
      }
    }

    res.status(200).json({
      success: true,
      departments: departments.map(d => ({
        _id: d._id,
        name: d.name,
        code: d.code,
        isActive: d.isActive !== false
      })),
      names: departments.map(d => d.name),
      list: DEPARTMENTS
    });
  } catch (error) {
    console.error('getDepartments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
};

// --- ADMIN MY PROFILE MANAGEMENT ---

exports.getAdminProfile = async (req, res) => {
  try {
    const adminId = req.currentUser._id;
    const user = await User.findById(adminId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Administrator profile not found' });
    }

    // Retrieve database departments
    let dbDepts = [];
    try {
      const institutionId = user.institution?._id || user.institution;
      if (institutionId) {
        dbDepts = await Class.distinct('department', { institution: institutionId });
      }
    } catch (_) {}

    const departmentsList = [...DEPARTMENTS.map(d => d.name)];
    for (const d of dbDepts) {
      if (d && typeof d === 'string' && !departmentsList.includes(d.trim())) {
        departmentsList.push(d.trim());
      }
    }

    return res.status(200).json({
      success: true,
      profile: {
        _id: user._id,
        userId: user.userId,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        designation: user.designation || '',
        highestQualification: user.highestQualification || '',
        qualifications: Array.isArray(user.qualifications) ? user.qualifications : [],
        department: user.department || '',
        specialization: user.specialization || '',
        profilePhoto: user.profilePhoto || '',
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      departments: departmentsList,
      qualifications: QUALIFICATION_OPTIONS,
      qualificationsOptions: QUALIFICATION_OPTIONS
    });
  } catch (error) {
    console.error('getAdminProfile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve administrator profile' });
  }
};

exports.updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.currentUser._id;
    const user = await User.findById(adminId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Administrator account not found' });
    }

    const {
      name,
      email,
      phone,
      designation,
      highestQualification,
      customQualification,
      otherQualification,
      qualifications,
      department,
      specialization,
      profilePhoto
    } = req.body;

    const errors = {};

    // 1. Validate Full Name (required, min 2 chars)
    if (name === undefined || typeof name !== 'string' || !name.trim()) {
      errors.name = 'Full Name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Full Name must be at least 2 characters long';
    }

    // 2. Validate Email (required, valid format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let cleanEmail = '';
    if (email === undefined || typeof email !== 'string' || !email.trim()) {
      errors.email = 'Official Email Address is required';
    } else {
      cleanEmail = email.trim().toLowerCase();
      if (!emailRegex.test(cleanEmail)) {
        errors.email = 'Please provide a valid email address';
      }
    }

    // 3. Check duplicate email if changed
    if (!errors.email && cleanEmail && cleanEmail !== user.email) {
      const existingUser = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
      if (existingUser) {
        errors.email = 'Email address is already in use by another account';
      }
    }

    // 4. Validate Phone if provided
    let cleanPhone = user.phone || '';
    if (phone !== undefined) {
      const phoneStr = String(phone).trim();
      if (phoneStr) {
        const phoneDigits = phoneStr.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
          errors.phone = 'Please provide a valid 10-digit contact number';
        } else {
          cleanPhone = phoneDigits;
        }
      } else {
        cleanPhone = '';
      }
    }

    // 5. Validate profile photo size if provided
    let cleanPhoto = user.profilePhoto || '';
    if (profilePhoto !== undefined) {
      if (typeof profilePhoto === 'string') {
        if (profilePhoto.startsWith('data:image/')) {
          const approxBytes = profilePhoto.length * 0.75;
          if (approxBytes > 3 * 1024 * 1024) {
            errors.profilePhoto = 'Profile photo file size must not exceed 3MB';
          } else {
            cleanPhoto = profilePhoto;
          }
        } else {
          cleanPhoto = profilePhoto.trim();
        }
      } else if (profilePhoto === null || profilePhoto === '') {
        cleanPhoto = '';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: Object.values(errors)[0],
        errors
      });
    }

    // Whitelist and apply permitted updates (Protected fields strictly untouched)
    user.name = name.trim();
    user.email = cleanEmail;
    user.phone = cleanPhone;

    if (designation !== undefined) {
      user.designation = typeof designation === 'string' ? designation.trim() : '';
    }

    if (department !== undefined) {
      user.department = typeof department === 'string' ? department.trim() : '';
    }

    if (specialization !== undefined) {
      user.specialization = typeof specialization === 'string' ? specialization.trim() : '';
    }

    // Handle qualifications array & highestQualification only if provided
    if (highestQualification !== undefined || customQualification !== undefined || otherQualification !== undefined || qualifications !== undefined) {
      let finalQual = highestQualification;
      const custom = typeof customQualification === 'string' ? customQualification.trim() : (typeof otherQualification === 'string' ? otherQualification.trim() : '');
      if ((finalQual === 'Other' || !finalQual) && custom) {
        finalQual = custom;
      }

      let normalizedQuals = [];
      if (Array.isArray(qualifications) && qualifications.length > 0) {
        normalizedQuals = qualifications.map(q => (typeof q === 'string' ? q.trim() : '')).filter(Boolean);
      } else if (finalQual && typeof finalQual === 'string') {
        normalizedQuals = [finalQual.trim()];
      }
      user.qualifications = normalizedQuals;
      user.highestQualification = (typeof finalQual === 'string' && finalQual.trim())
        ? finalQual.trim()
        : (normalizedQuals[0] || '');
    }

    if (profilePhoto !== undefined) {
      user.profilePhoto = cleanPhoto;
    }

    await user.save();

    // Sync session user
    if (req.session && req.session.user) {
      req.session.user.name = user.name;
    }

    // Record audit log
    try {
      if (user.institution) {
        await AuditLog.create({
          institution: user.institution,
          action: 'ADMIN_PROFILE_UPDATE',
          actor: user._id,
          targetType: 'User',
          targetId: user._id,
          details: { name: user.name, email: user.email, designation: user.designation }
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        designation: user.designation,
        highestQualification: user.highestQualification,
        qualifications: user.qualifications,
        department: user.department,
        specialization: user.specialization,
        profilePhoto: user.profilePhoto,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('updateAdminProfile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update administrator profile' });
  }
};

// --- INSTITUTION SETTINGS ---
exports.getInstitutionSetupStatus = async (req, res) => {
  try {
    const institution = await Institution.findById(req.currentUser.institution._id);
    res.status(200).json({ 
      success: true, 
      isSetupComplete: institution ? institution.isSetupComplete : false,
      institution
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check setup status' });
  }
};

exports.setupInstitution = async (req, res) => {
  try {
    const { name, code, description, type, website, address, city, state, country, email, phone, timezone, academicYear, logoUrl } = req.body;
    
    let institution = await Institution.findById(req.currentUser.institution._id);
    if (institution && institution.isSetupComplete) {
      return res.status(400).json({ success: false, error: 'Institution is already set up.' });
    }

    if (!institution) {
      institution = new Institution({});
    }

    institution.name = name;
    institution.code = code;
    institution.description = description;
    institution.type = type;
    institution.website = website;
    institution.address = address;
    institution.city = city;
    institution.state = state;
    institution.country = country;
    institution.email = email;
    institution.phone = phone;
    institution.timezone = timezone || 'UTC';
    institution.isSetupComplete = true;
    if (logoUrl !== undefined && logoUrl !== null) {
      institution.logoUrl = String(logoUrl).trim();
    }
    institution.lastUpdatedBy = req.currentUser._id;
    
    await institution.save();

    // Create Initial Academic Year if provided
    if (academicYear) {
       const existingYear = await AcademicYear.findOne({ year: academicYear.year, institution: institution._id });
       if (!existingYear) {
         const newYear = new AcademicYear({
           institution: institution._id,
           year: academicYear.year,
           startDate: academicYear.startDate,
           endDate: academicYear.endDate,
           structureType: academicYear.structureType,
           terms: academicYear.terms || [],
           isActive: true
         });
         await newYear.save();
       }
    }

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'SETUP_INSTITUTION', institution._id, 'Institution');
    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: 'College Profile Setup Completed',
      message: `Initial institutional setup for "${institution.name}" has been completed successfully.`,
      category: 'security_system',
      severity: 'success',
      destinationUrl: '/admin/college-settings'
    });
    res.status(200).json({ success: true, message: 'Setup completed successfully', institution });
  } catch (error) {
    console.error('Setup Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save setup configuration', stack: error.stack });
  }
};

exports.updateInstitutionSettings = async (req, res) => {
  try {
    const { logoUrl, name, code, description, email, phone } = req.body;
    const errors = {};

    // 1. Logo URL / reference (Optional, set via image upload or empty when cleared)
    // No URL validation required since URL text field has been removed

    // 2. Validate Institution Name
    if (!name || !String(name).trim()) {
      errors.name = 'Institution Name is required.';
    }

    // 3. Validate Code
    if (!code || !String(code).trim()) {
      errors.code = 'Institution Code is required.';
    }

    // 4. Validate Description
    if (!description || !String(description).trim()) {
      errors.description = 'Description is required.';
    }

    // 5. Validate Email Address
    if (!email || !String(email).trim()) {
      errors.email = 'Email Address is required.';
    } else if (!validateEmailFormat(String(email).trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    // 6. Validate Phone Number
    if (!phone || !String(phone).trim()) {
      errors.phone = 'Phone Number is required.';
    } else {
      const trimmedPhone = String(phone).trim();
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      const validChars = /^\+?[0-9\s\-()]{10,20}$/.test(trimmedPhone);
      if (digitsOnly.length < 10 || digitsOnly.length > 15 || !validChars) {
        errors.phone = 'Please provide a valid phone number (10-15 digits, optional country code).';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Please fill in all mandatory fields with valid values.',
        errors
      });
    }

    let institution = await Institution.findById(req.currentUser.institution._id);
    if (!institution) {
      institution = new Institution({ _id: req.currentUser.institution._id });
    }

    institution.logoUrl = (logoUrl !== undefined && logoUrl !== null) ? String(logoUrl).trim() : '';
    institution.name = String(name).trim();
    institution.code = String(code).trim();
    institution.description = String(description).trim();
    institution.email = String(email).trim().toLowerCase();
    institution.phone = String(phone).trim();

    // Preserve any other optional institution fields if present
    const optionalFields = ['type', 'website', 'address', 'city', 'state', 'country', 'timezone'];
    optionalFields.forEach(field => {
      if (req.body[field] !== undefined) {
        institution[field] = req.body[field];
      }
    });

    institution.lastUpdatedBy = req.currentUser._id;
    await institution.save();

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'UPDATE_INSTITUTION', institution._id, 'Institution');
    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: 'College Settings Updated',
      message: `Institutional configuration and branding for "${institution.name}" were updated.`,
      category: 'security_system',
      severity: 'info',
      destinationUrl: '/admin/college-settings'
    });
    return res.status(200).json({ success: true, message: 'Settings updated successfully', institution });
  } catch (error) {
    console.error('Update Institution Settings Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

exports.uploadInstitutionLogo = (req, res) => {
  uploadLogo(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Image file size exceeds the 5MB limit. Please choose a smaller image.'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to upload image.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file was provided. Please select an image (PNG, JPG, JPEG, or WebP).'
      });
    }

    const relativeUrl = `/uploads/logos/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: fullUrl,
      relativeUrl,
      filename: req.file.filename
    });
  });
};

// --- ADMINISTRATOR PREFERENCES ---
exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.currentUser._id).select('preferences');
    const defaultPreferences = {
      notifications: {
        inApp: true,
        academicRecords: true,
        accountActivity: true,
        riskAlerts: true
      }
    };
    const preferences = user?.preferences?.notifications
      ? user.preferences
      : defaultPreferences;

    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('getPreferences error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve preferences' });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const user = await User.findById(req.currentUser._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.preferences) {
      user.preferences = { notifications: {} };
    }
    if (!user.preferences.notifications) {
      user.preferences.notifications = {};
    }

    const { notifications } = req.body;
    if (notifications && typeof notifications === 'object') {
      if (typeof notifications.inApp === 'boolean') {
        user.preferences.notifications.inApp = notifications.inApp;
      }
      if (typeof notifications.academicRecords === 'boolean') {
        user.preferences.notifications.academicRecords = notifications.academicRecords;
      }
      if (typeof notifications.accountActivity === 'boolean') {
        user.preferences.notifications.accountActivity = notifications.accountActivity;
      }
      if (typeof notifications.riskAlerts === 'boolean') {
        user.preferences.notifications.riskAlerts = notifications.riskAlerts;
      }
    }

    user.markModified('preferences');
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Preferences saved successfully.',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('updatePreferences error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
};

// --- NOTIFICATIONS MANAGEMENT ---

exports.getNotifications = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const adminId = req.currentUser._id;

    // Synchronize real-time system/academic alerts based on current database state
    await syncSystemAndAcademicAlerts(institutionId, adminId);

    const {
      page = 1,
      limit = 10,
      status = 'all',
      category = 'all'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const filter = {
      institution: institutionId,
      recipient: adminId,
      isDismissed: false
    };

    if (status === 'unread') {
      filter.isRead = false;
    } else if (status === 'read') {
      filter.isRead = true;
    }

    const validCategories = ['students', 'teachers', 'departments_sections', 'academics', 'student_risks', 'security_system'];
    if (category === 'student_risks') {
      filter.$or = [
        { category: 'student_risks' },
        { 'metadata.isRisk': true }
      ];
    } else if (category === 'academics') {
      filter.category = 'academics';
      filter['metadata.isRisk'] = { $ne: true };
    } else if (category !== 'all' && validCategories.includes(category)) {
      filter.category = category;
    }

    const totalFiltered = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const baseFilter = {
      institution: institutionId,
      recipient: adminId,
      isDismissed: false
    };
    const totalCount = await Notification.countDocuments(baseFilter);
    const unreadCount = await Notification.countDocuments({ ...baseFilter, isRead: false });
    const readCount = totalCount - unreadCount;

    return res.status(200).json({
      success: true,
      notifications,
      pagination: {
        total: totalFiltered,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalFiltered / limitNum) || 1
      },
      counts: {
        total: totalCount,
        unread: unreadCount,
        read: readCount
      }
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

exports.getUnreadNotificationCount = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const adminId = req.currentUser._id;

    await syncSystemAndAcademicAlerts(institutionId, adminId);

    const unreadCount = await Notification.countDocuments({
      institution: institutionId,
      recipient: adminId,
      isDismissed: false,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('getUnreadNotificationCount error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch unread notification count' });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.currentUser._id,
        institution: req.currentUser.institution._id
      },
      {
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({
      institution: req.currentUser.institution._id,
      recipient: req.currentUser._id,
      isDismissed: false,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
      unreadCount
    });
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.currentUser._id,
        institution: req.currentUser.institution._id,
        isDismissed: false,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount || 0
    });
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.currentUser._id,
        institution: req.currentUser.institution._id
      },
      {
        isDismissed: true
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({
      institution: req.currentUser.institution._id,
      recipient: req.currentUser._id,
      isDismissed: false,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      message: 'Notification dismissed',
      unreadCount
    });
  } catch (error) {
    console.error('deleteNotification error:', error);
    return res.status(500).json({ success: false, error: 'Failed to dismiss notification' });
  }
};

exports.bulkMarkNotificationsAsRead = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please provide a non-empty array of notification IDs' });
    }

    const mongoose = require('mongoose');
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid notification IDs provided' });
    }

    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const adminId = req.currentUser._id;

    const result = await Notification.updateMany(
      {
        _id: { $in: validIds },
        recipient: adminId,
        institution: institutionId,
        isDismissed: false,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    const baseFilter = {
      institution: institutionId,
      recipient: adminId,
      isDismissed: false
    };
    const totalCount = await Notification.countDocuments(baseFilter);
    const unreadCount = await Notification.countDocuments({ ...baseFilter, isRead: false });
    const readCount = totalCount - unreadCount;

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount || 0} notification(s) marked as read`,
      updatedCount: result.modifiedCount || 0,
      counts: {
        total: totalCount,
        unread: unreadCount,
        read: readCount
      }
    });
  } catch (error) {
    console.error('bulkMarkNotificationsAsRead error:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark selected notifications as read' });
  }
};

exports.bulkDeleteNotifications = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please provide a non-empty array of notification IDs' });
    }

    const mongoose = require('mongoose');
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid notification IDs provided' });
    }

    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;
    const adminId = req.currentUser._id;

    const result = await Notification.updateMany(
      {
        _id: { $in: validIds },
        recipient: adminId,
        institution: institutionId
      },
      {
        $set: {
          isDismissed: true
        }
      }
    );

    const baseFilter = {
      institution: institutionId,
      recipient: adminId,
      isDismissed: false
    };
    const totalCount = await Notification.countDocuments(baseFilter);
    const unreadCount = await Notification.countDocuments({ ...baseFilter, isRead: false });
    const readCount = totalCount - unreadCount;

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount || 0} notification(s) deleted`,
      deletedCount: result.modifiedCount || 0,
      counts: {
        total: totalCount,
        unread: unreadCount,
        read: readCount
      }
    });
  } catch (error) {
    console.error('bulkDeleteNotifications error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete selected notifications' });
  }
};

// --- ACADEMIC YEAR MANAGEMENT ---
exports.getAcademicYears = async (req, res) => {
  try {
    const years = await AcademicYear.find({ institution: req.currentUser.institution._id }).sort({ startDate: -1 });
    res.status(200).json({ success: true, years });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch academic years' });
  }
};

exports.createAcademicYear = async (req, res) => {
  try {
    const { year, startDate, endDate, structureType, terms, makeActive } = req.body;
    
    if (makeActive) {
      await AcademicYear.updateMany({ institution: req.currentUser.institution._id }, { isActive: false });
    }

    const newYear = new AcademicYear({
      institution: req.currentUser.institution._id,
      year, startDate, endDate, structureType, terms, isActive: makeActive || false
    });
    await newYear.save();
    
    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'CREATE_ACADEMIC_YEAR', newYear._id, 'AcademicYear', { year });
    res.status(201).json({ success: true, message: 'Academic year created', academicYear: newYear });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create academic year' });
  }
};

exports.activateAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { termId } = req.body; // Optional term to activate

    await AcademicYear.updateMany({ institution: req.currentUser.institution._id }, { isActive: false });
    const year = await AcademicYear.findOne({ _id: id, institution: req.currentUser.institution._id });
    if (!year) return res.status(404).json({ success: false, error: 'Academic year not found' });
    
    year.isActive = true;
    if (termId && year.terms) {
      year.terms.forEach(t => t.isActive = (t._id.toString() === termId));
    }
    await year.save();

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'ACTIVATE_ACADEMIC_YEAR', year._id, 'AcademicYear', { year: year.year });
    res.status(200).json({ success: true, message: 'Academic year activated', academicYear: year });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to activate academic year' });
  }
};

// --- DASHBOARD ANALYTICS ---
exports.getEnrollmentAnalytics = async (req, res) => {
  try {
    // Group students by creation month
    const students = await User.find({ role: 'student', institution: req.currentUser.institution._id }).select('createdAt');
    const enrollmentMap = {};
    
    students.forEach(s => {
      const date = new Date(s.createdAt);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      enrollmentMap[monthYear] = (enrollmentMap[monthYear] || 0) + 1;
    });

    const data = Object.keys(enrollmentMap).map(key => ({ name: key, students: enrollmentMap[key] }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch enrollment analytics' });
  }
};

exports.getPerformanceAnalytics = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;

    // Group records by Academic Year for Year-by-Year analytics
    const records = await AcademicRecord.find({ institution: institutionId })
      .populate('academicYear', 'year isActive startDate endDate')
      .populate('student', '_id isActive');
    
    // De-duplicate duplicate records for same student + subject + academicYear + term
    // Keep the latest record by updatedAt / createdAt
    const sortedRecords = [...records].sort((a, b) => 
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );

    const seenAssessmentKeys = new Set();
    const uniqueAssessmentRecords = [];
    const seenAttendanceKeys = new Set();
    const uniqueAttendanceRecords = [];

    sortedRecords.forEach(r => {
      // Ignore records with missing student or academicYear
      if (!r.student || !r.academicYear || !r.academicYear.year) return;
      const yearStr = r.academicYear.year;
      const termKey = r.termId ? r.termId.toString() : 'no-term';
      const studentKey = r.student._id ? r.student._id.toString() : r.student.toString();
      const subjectKey = r.subject ? r.subject.toString() : 'no-subject';
      const compositeKey = `${yearStr}_${studentKey}_${subjectKey}_${termKey}`;

      // Check valid assessment marks: must have valid numeric marksObtained and totalMarks > 0
      const hasValidMarks = typeof r.marksObtained === 'number' &&
        !isNaN(r.marksObtained) &&
        r.marksObtained !== null &&
        typeof r.totalMarks === 'number' &&
        !isNaN(r.totalMarks) &&
        r.totalMarks !== null &&
        r.totalMarks > 0 &&
        r.marksObtained >= 0;

      if (hasValidMarks && !seenAssessmentKeys.has(compositeKey)) {
        seenAssessmentKeys.add(compositeKey);
        uniqueAssessmentRecords.push({
          year: yearStr,
          marksObtained: r.marksObtained,
          totalMarks: r.totalMarks,
          normalizedScore: Math.min(100, Math.max(0, (r.marksObtained / r.totalMarks) * 100))
        });
      }

      // Check valid attendance: must have explicit numeric attendance percentage between 0 and 100
      const hasValidAttendance = typeof r.attendancePercentage === 'number' &&
        !isNaN(r.attendancePercentage) &&
        r.attendancePercentage !== null &&
        r.attendancePercentage >= 0 &&
        r.attendancePercentage <= 100;

      if (hasValidAttendance && !seenAttendanceKeys.has(compositeKey)) {
        seenAttendanceKeys.add(compositeKey);
        uniqueAttendanceRecords.push({
          year: yearStr,
          attendancePercentage: r.attendancePercentage
        });
      }
    });

    const yearPerfMap = {};
    const yearPerfCount = {};
    uniqueAssessmentRecords.forEach(r => {
      yearPerfMap[r.year] = (yearPerfMap[r.year] || 0) + r.normalizedScore;
      yearPerfCount[r.year] = (yearPerfCount[r.year] || 0) + 1;
    });

    const performance = Object.keys(yearPerfMap).map(year => ({
      year,
      averageScore: Math.round(yearPerfMap[year] / yearPerfCount[year]),
      count: yearPerfCount[year]
    })).sort((a, b) => a.year.localeCompare(b.year));

    const yearAttMap = {};
    const yearAttCount = {};
    uniqueAttendanceRecords.forEach(r => {
      yearAttMap[r.year] = (yearAttMap[r.year] || 0) + r.attendancePercentage;
      yearAttCount[r.year] = (yearAttCount[r.year] || 0) + 1;
    });

    const attendance = Object.keys(yearAttMap).map(year => ({
      year,
      averageAttendance: Math.round(yearAttMap[year] / yearAttCount[year]),
      count: yearAttCount[year]
    })).sort((a, b) => a.year.localeCompare(b.year));

    // Determine latest average only from valid records in the selected reporting period
    const activeYearDoc = await AcademicYear.findOne({ isActive: true, institution: institutionId });
    let latestScore = null;
    let latestAttendance = null;

    if (activeYearDoc && yearPerfMap[activeYearDoc.year] !== undefined) {
      latestScore = Math.round(yearPerfMap[activeYearDoc.year] / yearPerfCount[activeYearDoc.year]);
    } else if (!activeYearDoc && performance.length > 0) {
      latestScore = performance[performance.length - 1].averageScore;
    }

    if (activeYearDoc && yearAttMap[activeYearDoc.year] !== undefined) {
      latestAttendance = Math.round(yearAttMap[activeYearDoc.year] / yearAttCount[activeYearDoc.year]);
    } else if (!activeYearDoc && attendance.length > 0) {
      latestAttendance = attendance[attendance.length - 1].averageAttendance;
    }

    // Overall averages across all valid records
    const overallScoreSum = uniqueAssessmentRecords.reduce((acc, r) => acc + r.normalizedScore, 0);
    const overallAverageScore = uniqueAssessmentRecords.length > 0
      ? Math.round(overallScoreSum / uniqueAssessmentRecords.length)
      : null;

    const overallAttSum = uniqueAttendanceRecords.reduce((acc, r) => acc + r.attendancePercentage, 0);
    const overallAverageAttendance = uniqueAttendanceRecords.length > 0
      ? Math.round(overallAttSum / uniqueAttendanceRecords.length)
      : null;

    res.status(200).json({ 
      success: true, 
      data: { 
        performance, 
        attendance,
        latestScore,
        latestAttendance,
        overallAverageScore,
        overallAverageAttendance,
        hasPerformanceData: performance.length > 0,
        hasAttendanceData: attendance.length > 0
      } 
    });
  } catch (error) {
    console.error('getPerformanceAnalytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch performance analytics' });
  }
};

/**
 * @route   GET /api/admin/accounts
 * @desc    Get canonical list of active accounts across all roles (Admin, Teacher, Student)
 */
exports.getActiveAccounts = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution?._id || req.currentUser.institution;

    // Fetch active users across all roles (Student, Teacher, Admin) strictly for the active institution
    // Exclude password and secrets
    const activeUsers = await User.find({
      isActive: true,
      role: { $in: ['student', 'teacher', 'admin', 'superadmin'] },
      institution: institutionId
    })
      .select('userId name role isActive createdAt mustChangePassword institution')
      .sort({ createdAt: -1 });

    const userIds = activeUsers.map(u => u._id);

    // Fetch student profile details for students in this list
    const studentProfiles = await StudentProfile.find({
      institution: institutionId,
      user: { $in: userIds }
    }).select('user personalInfo studentId course department section batch classRef');

    const studentMap = {};
    studentProfiles.forEach(sp => {
      if (sp.user) {
        studentMap[sp.user.toString()] = sp;
      }
    });

    // Fetch teacher profile details for teachers in this list
    const teacherProfiles = await TeacherProfile.find({
      institution: institutionId,
      user: { $in: userIds }
    }).select('user personalInfo teacherId department designation professionalInfo');

    const teacherMap = {};
    teacherProfiles.forEach(tp => {
      if (tp.user) {
        teacherMap[tp.user.toString()] = tp;
      }
    });

    // Map each canonical user account exactly once
    const accounts = activeUsers.map(user => {
      const uid = user._id.toString();
      const student = studentMap[uid];
      const teacher = teacherMap[uid];

      let email = null;
      let profileId = null;
      let profileIdentifier = null;
      let department = null;

      if (user.role === 'student' && student) {
        email = student.personalInfo?.email || null;
        profileId = student._id;
        profileIdentifier = student.studentId;
        department = student.department;
      } else if (user.role === 'teacher' && teacher) {
        email = teacher.personalInfo?.email || null;
        profileId = teacher._id;
        profileIdentifier = teacher.teacherId;
        department = teacher.department;
      } else if (user.role === 'admin' || user.role === 'superadmin') {
        if (req.currentUser._id.toString() === uid && req.currentUser.institution?.email) {
          email = req.currentUser.institution.email;
        }
      }

      // Name resolution
      let name = user.name || '';
      if (!name) {
        if (teacher && teacher.personalInfo?.name) {
          name = teacher.personalInfo.name;
        } else if (student && student.personalInfo?.name) {
          name = student.personalInfo.name;
        } else if (user.role === 'admin') {
          name = 'Administrator';
        } else {
          name = user.userId;
        }
      }

      return {
        _id: user._id,
        userId: user.userId,
        name,
        role: user.role,
        email: email || '',
        isActive: user.isActive,
        profileId,
        profileIdentifier,
        department,
        createdAt: user.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      totalCount: accounts.length,
      accounts
    });
  } catch (error) {
    console.error('getActiveAccounts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active accounts'
    });
  }
};

exports.getRiskOverview = async (req, res) => {
  try {
    const risks = await RiskPrediction.find({ institution: req.currentUser.institution._id });
    let low = 0, medium = 0, high = 0;
    
    risks.forEach(r => {
      if (r.riskLevel === 'low') low++;
      if (r.riskLevel === 'medium') medium++;
      if (r.riskLevel === 'high') high++;
    });

    res.status(200).json({ 
      success: true, 
      data: [
        { name: 'Low Risk', value: low, color: '#10b981' },
        { name: 'Medium Risk', value: medium, color: '#f59e0b' },
        { name: 'High Risk', value: high, color: '#ef4444' }
      ],
      total: risks.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch risk overview' });
  }
};

exports.getRecentActivity = async (req, res) => {
  try {
    const logs = await AuditLog.find({ institution: req.currentUser.institution._id }).sort({ createdAt: -1 }).limit(10).populate('actor', 'name role');
    res.status(200).json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch recent activity' });
  }
};


// Helper to normalize academic year of study (First Year, Second Year, Third Year, Fourth Year)
const normalizeYearOfStudy = (yearOfStudy, semester) => {
  if (yearOfStudy && typeof yearOfStudy === 'string') {
    const y = yearOfStudy.trim().toLowerCase();
    if (y.includes('first') || y === '1' || y.startsWith('1st') || y.includes('year 1') || y.includes('1st year')) return 'First Year';
    if (y.includes('second') || y === '2' || y.startsWith('2nd') || y.includes('year 2') || y.includes('2nd year')) return 'Second Year';
    if (y.includes('third') || y === '3' || y.startsWith('3rd') || y.includes('year 3') || y.includes('3rd year')) return 'Third Year';
    if (y.includes('fourth') || y === '4' || y.startsWith('4th') || y.includes('year 4') || y.includes('4th year')) return 'Fourth Year';
  }
  if (semester !== undefined && semester !== null) {
    const clean = String(semester).trim().toLowerCase();
    const match = clean.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num === 1 || num === 2) return 'First Year';
      if (num === 3 || num === 4) return 'Second Year';
      if (num === 5 || num === 6) return 'Third Year';
      if (num === 7 || num === 8) return 'Fourth Year';
    }
  }
  return 'First Year';
};

// Department name/code alias map for flexible matching
const deptAliasMap = {};
DEPARTMENTS.forEach(d => {
  deptAliasMap[d.code.toLowerCase()] = d.name.toLowerCase();
  deptAliasMap[d.name.toLowerCase()] = d.code.toLowerCase();
});

const isDeptMatch = (dept1, dept2) => {
  if (!dept1 || !dept2) return false;
  const d1 = String(dept1).toLowerCase().trim();
  const d2 = String(dept2).toLowerCase().trim();
  if (d1 === d2) return true;
  if (deptAliasMap[d1] === d2 || deptAliasMap[d2] === d1) return true;
  return false;
};

const isSemMatch = (sem1, sem2) => {
  if (sem1 === undefined || sem2 === undefined) return false;
  const s1 = String(sem1).replace(/[^0-9]/g, '');
  const s2 = String(sem2).replace(/[^0-9]/g, '');
  return s1 === s2;
};

const isSecMatch = (sec1, sec2) => {
  if (!sec1 || !sec2) return false;
  const s1 = String(sec1).replace(/^section\s+/i, '').trim().toLowerCase();
  const s2 = String(sec2).replace(/^section\s+/i, '').trim().toLowerCase();
  return s1 === s2;
};

// Helper to find a configured student group matching validated academic details
const findConfiguredStudentGroup = async ({
  institutionId,
  course,
  department,
  academicYear,
  semester,
  section,
  session
}) => {
  const cleanCourse = course && typeof course === 'string' ? course.trim() : '';
  const cleanDepartment = department && typeof department === 'string' ? department.trim() : '';
  const cleanAcademicYear = academicYear && typeof academicYear === 'string' ? academicYear.trim() : '';
  const cleanSemester = semester !== undefined && semester !== null ? String(semester).trim() : '';
  const cleanSection = section && typeof section === 'string' ? section.trim() : '';

  if (!cleanCourse || !cleanDepartment || !cleanAcademicYear || !cleanSemester || !cleanSection) {
    const error = new Error('Incomplete academic grouping parameters.');
    error.status = 400;
    throw error;
  }

  const query = Class.find({ institution: institutionId, isActive: true });
  if (session) query.session(session);
  const classes = await query;

  const matched = classes.find(c => {
    const courseOk = (c.course || '').toLowerCase().trim() === cleanCourse.toLowerCase().trim();
    const semOk = isSemMatch(c.semester, cleanSemester);
    const secOk = isSecMatch(c.section, cleanSection);
    const deptOk = isDeptMatch(c.department, cleanDepartment) ||
      (c.departmentRef && String(c.departmentRef) === String(cleanDepartment));
    return courseOk && semOk && secOk && deptOk;
  });

  return matched || null;
};

exports.createStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { studentId, password, course, department, academicYear, semester, section, batch, personalInfo, learningProfile } = req.body;

    const errors = {};

    const cleanStudentId = studentId && typeof studentId === 'string' ? studentId.trim().toLowerCase() : '';
    if (!cleanStudentId) {
      errors.studentId = 'Student Login ID is required';
    }

    if (!password) {
      errors.password = 'Initial password is required';
    } else if (!validatePasswordStrength(password)) {
      errors.password = 'Password must be at least 8 characters and include letters and numbers or symbols';
    }

    const rawName = (personalInfo && personalInfo.name) || req.body.name || '';
    const cleanName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!cleanName) {
      errors.name = 'Full Name is required';
    }

    const rawEmail = (personalInfo && personalInfo.email) || req.body.email || '';
    const cleanEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!cleanEmail) {
      errors.email = 'Email Address is required';
    } else if (!validateEmailFormat(cleanEmail)) {
      errors.email = 'Please provide a valid email address';
    }

    const cleanCourse = course && typeof course === 'string' ? course.trim() : '';
    if (!cleanCourse || cleanCourse.toLowerCase().startsWith('select')) {
      errors.course = 'Course is required';
    }

    const cleanDepartment = department && typeof department === 'string' ? department.trim() : '';
    if (!cleanDepartment || cleanDepartment.toLowerCase().startsWith('select')) {
      errors.department = 'Department is required';
    }

    let targetDepartment = cleanDepartment;
    let targetDepartmentDoc = null;
    if (cleanDepartment && !errors.department) {
      if (mongoose.Types.ObjectId.isValid(cleanDepartment) && /^[0-9a-fA-F]{24}$/.test(cleanDepartment)) {
        targetDepartmentDoc = await Department.findOne({
          _id: cleanDepartment,
          institution: req.currentUser.institution._id
        }).session(session);

        if (!targetDepartmentDoc) {
          errors.department = 'Referenced department does not exist in this institution.';
        } else {
          targetDepartment = targetDepartmentDoc.name;
        }
      } else {
        targetDepartmentDoc = await Department.findOne({
          institution: req.currentUser.institution._id,
          $or: [
            { name: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') },
            { code: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') }
          ]
        }).session(session);

        if (targetDepartmentDoc) {
          targetDepartment = targetDepartmentDoc.name;
        } else {
          const configDept = DEPARTMENTS.find(d =>
            d.name.toLowerCase() === cleanDepartment.toLowerCase() ||
            d.code.toLowerCase() === cleanDepartment.toLowerCase()
          );
          if (configDept) {
            targetDepartment = configDept.name;
          }
        }
      }
    }

    const cleanSemester = semester !== undefined && semester !== null ? String(semester).trim() : '';
    if (!cleanSemester || cleanSemester.toLowerCase().startsWith('select')) {
      errors.semester = 'Semester is required';
    }

    const cleanAcademicYear = academicYear && typeof academicYear === 'string' ? academicYear.trim() : '';
    if (!cleanAcademicYear) {
      errors.academicYear = 'Academic Year is required';
    }

    const cleanSection = section && typeof section === 'string' ? section.trim() : '';
    if (!cleanSection) {
      errors.section = 'Section is required';
    }

    if (Object.keys(errors).length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Validation failed. Please correct the highlighted errors.',
        errors
      });
    }

    const existingUser = await User.findOne({ userId: cleanStudentId }).session(session);
    const existingStudent = await StudentProfile.findOne({ studentId: cleanStudentId }).session(session);
    if (existingUser || existingStudent) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Student Login ID already exists',
        errors: { studentId: 'Student Login ID already exists' }
      });
    }

    const existingEmail = await StudentProfile.findOne({
      institution: req.currentUser.institution._id,
      'personalInfo.email': cleanEmail
    }).session(session);
    if (existingEmail) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Email Address already exists',
        errors: { email: 'Email Address already exists' }
      });
    }

    // Automatically identify configured group for student (admin never manually assigns group)
    const studentGroup = await findConfiguredStudentGroup({
      institutionId: req.currentUser.institution._id,
      course: cleanCourse,
      department: targetDepartment,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      section: cleanSection,
      session
    });

    if (!studentGroup) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Section "${cleanSection}" is not configured for ${targetDepartment} (Semester ${cleanSemester}). Please configure the department and section under Classes & Student Groups before creating students.`,
        errors: {
          section: `Section "${cleanSection}" is not configured for ${targetDepartment}. Please set up the section under Classes & Student Groups first.`
        }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      institution: req.currentUser.institution._id,
      userId: cleanStudentId,
      password: hashedPassword,
      role: 'student',
      name: cleanName,
      mustChangePassword: true
    });
    await user.save({ session });

    const derivedYear = studentGroup.yearOfStudy || normalizeYearOfStudy(null, cleanSemester);
    const studentProfile = new StudentProfile({
      institution: req.currentUser.institution._id,
      user: user._id,
      studentId: cleanStudentId,
      course: cleanCourse,
      department: studentGroup.department || targetDepartment,
      departmentRef: targetDepartmentDoc ? targetDepartmentDoc._id : undefined,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      yearOfStudy: derivedYear,
      classRef: studentGroup._id,
      section: studentGroup.section,
      batch,
      personalInfo: {
        ...(personalInfo || {}),
        name: cleanName,
        email: cleanEmail
      },
      learningProfile
    });
    await studentProfile.save({ session });

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'CREATE_STUDENT', user._id, 'User', {
      studentId: cleanStudentId,
      groupId: studentGroup._id
    });

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: `New Student Registered: ${cleanName}`,
      message: `Student account for ${cleanName} (ID: ${cleanStudentId}) was created and assigned to ${studentGroup.department} Section ${studentGroup.section}.`,
      category: 'students',
      severity: 'success',
      relatedEntityType: 'StudentProfile',
      relatedEntityId: studentProfile._id,
      destinationUrl: `/admin/students/${studentProfile._id}`,
      eventKey: `CREATE_STUDENT_${cleanStudentId}`
    });

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      studentId: cleanStudentId,
      group: {
        _id: studentGroup._id,
        name: studentGroup.name,
        course: studentGroup.course,
        department: studentGroup.department,
        academicYear: studentGroup.academicYear,
        semester: studentGroup.semester,
        section: studentGroup.section
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createStudent error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create student' });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const students = await StudentProfile.find({ institution: req.currentUser.institution._id })
      .populate('user', 'userId name role isActive createdAt mustChangePassword')
      .populate('classRef', 'name section course department academicYear semester isActive')
      .populate('departmentRef', 'name code');
    res.status(200).json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const student = await StudentProfile.findOne({
      _id: id,
      institution: req.currentUser.institution._id
    })
      .populate('user', 'userId name role isActive createdAt mustChangePassword')
      .populate('classRef', 'name section course department academicYear semester isActive')
      .populate('departmentRef', 'name code');

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.status(200).json({ success: true, student });
  } catch (error) {
    console.error('Error fetching student by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch student' });
  }
};

exports.updateStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { studentId, course, department, academicYear, semester, section, batch, personalInfo, learningProfile } = req.body;
    
    const studentProfile = await StudentProfile.findOne({ _id: id, institution: req.currentUser.institution._id }).session(session);
    if (!studentProfile) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    if (studentId && studentId.toLowerCase() !== studentProfile.studentId) {
       const existingProfile = await StudentProfile.findOne({ studentId: studentId.toLowerCase(), institution: req.currentUser.institution._id }).session(session);
       if (existingProfile) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: 'Student ID already exists in this institution' });
       }
       const existingUser = await User.findOne({ userId: studentId.toLowerCase(), institution: req.currentUser.institution._id }).session(session);
       if (existingUser) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: 'User ID already exists in this institution' });
       }
       studentProfile.studentId = studentId.toLowerCase();
    }

    // Resolve and validate department
    let targetDepartment = studentProfile.department;
    let targetDepartmentDoc = null;

    if (department !== undefined && department !== null) {
      const rawDept = typeof department === 'string' ? department.trim() : String(department);
      if (!rawDept || rawDept.toLowerCase().startsWith('select')) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'Department is required' });
      }

      // If rawDept is a MongoDB ObjectId, validate against Department collection
      if (mongoose.Types.ObjectId.isValid(rawDept) && /^[0-9a-fA-F]{24}$/.test(rawDept)) {
        targetDepartmentDoc = await Department.findOne({
          _id: rawDept,
          institution: req.currentUser.institution._id
        }).session(session);

        if (!targetDepartmentDoc) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            error: 'Referenced department does not exist in this institution.'
          });
        }
        targetDepartment = targetDepartmentDoc.name;
      } else {
        // Search by department name or code
        targetDepartmentDoc = await Department.findOne({
          institution: req.currentUser.institution._id,
          $or: [
            { name: new RegExp(`^${escapeRegex(rawDept)}$`, 'i') },
            { code: new RegExp(`^${escapeRegex(rawDept)}$`, 'i') }
          ]
        }).session(session);

        if (targetDepartmentDoc) {
          targetDepartment = targetDepartmentDoc.name;
        } else {
          // If not in database, check config or accept valid custom department
          const configDept = DEPARTMENTS.find(d =>
            d.name.toLowerCase() === rawDept.toLowerCase() ||
            d.code.toLowerCase() === rawDept.toLowerCase()
          );
          if (configDept) {
            targetDepartment = configDept.name;
          } else {
            targetDepartment = rawDept;
          }
        }
      }
    }

    // Check if department changed
    const isDeptChanged = (
      department !== undefined &&
      department !== null &&
      targetDepartment !== studentProfile.department &&
      !isDeptMatch(studentProfile.department, targetDepartment)
    );

    // Check if grouping fields are being updated or if student currently lacks classRef
    const isAcademicGroupingChanged = (
      (course !== undefined && course.trim() !== studentProfile.course) ||
      isDeptChanged ||
      (academicYear !== undefined && academicYear.trim() !== studentProfile.academicYear) ||
      (semester !== undefined && String(semester).trim() !== studentProfile.semester) ||
      (section !== undefined && section.trim() !== studentProfile.section) ||
      !studentProfile.classRef
    );

    const targetCourse = course !== undefined ? (typeof course === 'string' ? course.trim() : '') : studentProfile.course;
    const targetAcademicYear = academicYear !== undefined ? (typeof academicYear === 'string' ? academicYear.trim() : '') : studentProfile.academicYear;
    const targetSemester = semester !== undefined ? String(semester).trim() : studentProfile.semester;
    const targetSection = section !== undefined ? (typeof section === 'string' ? section.trim() : '') : studentProfile.section;

    if (isAcademicGroupingChanged) {
      if (!targetCourse || targetCourse.toLowerCase().startsWith('select')) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'Course is required' });
      }
      if (!targetDepartment || targetDepartment.toLowerCase().startsWith('select')) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'Department is required' });
      }
      if (!targetAcademicYear) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'Academic Year is required' });
      }
      if (!targetSemester || targetSemester.toLowerCase().startsWith('select')) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'Semester is required' });
      }
      if (!targetSection) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'Section is required' });
      }

      // Automatically identify configured group matching updated academic details
      const targetGroup = await findConfiguredStudentGroup({
        institutionId: req.currentUser.institution._id,
        course: targetCourse,
        department: targetDepartment,
        academicYear: targetAcademicYear,
        semester: targetSemester,
        section: targetSection,
        session
      });

      if (!targetGroup) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: `Section "${targetSection}" is not configured for ${targetDepartment} (Semester ${targetSemester}). Please configure the department and section under Classes & Student Groups before updating student profile.`,
          errors: {
            section: `Section "${targetSection}" is not configured for this department and semester.`
          }
        });
      }

      const derivedYear = targetGroup.yearOfStudy || normalizeYearOfStudy(null, targetSemester);
      studentProfile.classRef = targetGroup._id;
      studentProfile.course = targetCourse;
      studentProfile.department = targetGroup.department;
      if (targetDepartmentDoc) {
        studentProfile.departmentRef = targetDepartmentDoc._id;
      }
      studentProfile.academicYear = targetAcademicYear;
      studentProfile.semester = targetSemester;
      studentProfile.yearOfStudy = derivedYear;
      studentProfile.section = targetGroup.section;
    } else {
      if (targetDepartmentDoc) {
        studentProfile.departmentRef = targetDepartmentDoc._id;
      }
      if (department !== undefined && department !== null && targetDepartment) {
        studentProfile.department = targetDepartment;
      }
    }

    if (batch !== undefined) studentProfile.batch = batch;
    
    if (personalInfo) {
      if (!studentProfile.personalInfo) studentProfile.personalInfo = {};
      if (personalInfo.email !== undefined) studentProfile.personalInfo.email = personalInfo.email;
      if (personalInfo.phone !== undefined) studentProfile.personalInfo.phone = personalInfo.phone;
      if (personalInfo.dateOfBirth !== undefined) studentProfile.personalInfo.dateOfBirth = personalInfo.dateOfBirth;
      if (personalInfo.address !== undefined) studentProfile.personalInfo.address = personalInfo.address;
    }

    if (learningProfile) {
      studentProfile.learningProfile = learningProfile;
    }

    await studentProfile.save({ session });

    const user = await User.findById(studentProfile.user).session(session);
    if (user) {
      if (personalInfo && personalInfo.name !== undefined) {
         user.name = personalInfo.name;
      }
      if (studentId && studentId.toLowerCase() !== user.userId) {
         user.userId = studentId.toLowerCase();
      }
      await user.save({ session });
    }

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'UPDATE_STUDENT', studentProfile._id, 'StudentProfile', {
      studentId: studentProfile.studentId,
      classRef: studentProfile.classRef
    });

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: `Student Updated: ${user?.name || studentProfile.studentId}`,
      message: `Profile and academic enrollment details for student ${studentProfile.studentId} were updated.`,
      category: 'students',
      severity: 'info',
      relatedEntityType: 'StudentProfile',
      relatedEntityId: studentProfile._id,
      destinationUrl: `/admin/students/${studentProfile._id}`
    });

    const updatedStudent = await StudentProfile.findById(id)
      .populate('user', 'name isActive createdAt mustChangePassword')
      .populate('classRef', 'name section course department academicYear semester isActive');
    res.status(200).json({ success: true, message: 'Student updated successfully', student: updatedStudent });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updateStudent error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update student' });
  }
};

exports.createTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { teacherId, password, department, designation, personalInfo, professionalInfo, teachingAssignments, isActive } = req.body;

    const errors = {};

    const cleanTeacherId = teacherId && typeof teacherId === 'string' ? teacherId.trim().toLowerCase() : '';
    if (!cleanTeacherId) {
      errors.teacherId = 'Teacher/Faculty ID is required';
    }

    if (!password) {
      errors.password = 'Initial password is required';
    } else if (!validatePasswordStrength(password)) {
      errors.password = 'Password must be at least 8 characters and include letters and numbers or symbols';
    }

    const rawName = (personalInfo && personalInfo.name) || req.body.name || '';
    const cleanName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!cleanName) {
      errors.name = 'Full Name is required';
    }

    const rawEmail = (personalInfo && personalInfo.email) || req.body.email || '';
    const cleanEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!cleanEmail) {
      errors.email = 'Email Address is required';
    } else if (!validateEmailFormat(cleanEmail)) {
      errors.email = 'Please provide a valid email address';
    }

    const rawPhone = (personalInfo && personalInfo.phone) || req.body.phone || '';
    const cleanPhone = typeof rawPhone === 'string' ? rawPhone.trim() : '';
    if (!cleanPhone) {
      errors.phone = 'Phone Number is required';
    } else if (!validatePhoneFormat(cleanPhone)) {
      errors.phone = 'Please provide a valid 10-digit phone number';
    }

    const rawAddress = (personalInfo && personalInfo.address) || req.body.address || '';
    const cleanAddress = typeof rawAddress === 'string' ? rawAddress.trim() : '';
    if (!cleanAddress) {
      errors.address = 'Address is required';
    }

    let cleanDepartment = department && typeof department === 'string' ? department.trim() : (department ? String(department).trim() : '');
    let targetDeptDoc = null;
    if (cleanDepartment && mongoose.Types.ObjectId.isValid(cleanDepartment) && /^[0-9a-fA-F]{24}$/.test(cleanDepartment)) {
      targetDeptDoc = await Department.findOne({ _id: cleanDepartment, institution: req.currentUser.institution._id }).session(session);
      if (!targetDeptDoc) {
        errors.department = 'Referenced department does not exist in this institution.';
      } else {
        cleanDepartment = targetDeptDoc.name;
      }
    } else if (cleanDepartment) {
      targetDeptDoc = await Department.findOne({
        institution: req.currentUser.institution._id,
        $or: [
          { name: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') },
          { code: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') }
        ]
      }).session(session);
      if (targetDeptDoc) {
        cleanDepartment = targetDeptDoc.name;
      }
    }
    if (!cleanDepartment || cleanDepartment.toLowerCase().startsWith('select')) {
      errors.department = 'Department is required';
    }

    const cleanDesignation = designation && typeof designation === 'string' ? designation.trim() : '';
    if (!cleanDesignation || cleanDesignation.toLowerCase().startsWith('select')) {
      errors.designation = 'Designation is required';
    }

    const cleanQualifications = normalizeQualifications(req.body);
    if (cleanQualifications.length === 0) {
      errors.qualifications = 'Qualification is required';
      errors.highestQualification = 'Qualification is required';
    }
    const cleanQualification = cleanQualifications.join(', ');

    const rawSpec = (professionalInfo && professionalInfo.specialization) || req.body.specialization || '';
    const cleanSpecialization = typeof rawSpec === 'string' ? rawSpec.trim() : '';
    if (!cleanSpecialization || cleanSpecialization.toLowerCase().startsWith('select')) {
      errors.specialization = 'Specialization is required';
    }

    const expValue = (professionalInfo && professionalInfo.yearsOfExperience !== undefined) ? professionalInfo.yearsOfExperience : req.body.yearsOfExperience;
    if (expValue === undefined || expValue === null || expValue === '' || String(expValue).trim() === '') {
      errors.yearsOfExperience = 'Years of Experience is required';
    } else if (!validateExperience(expValue)) {
      errors.yearsOfExperience = 'Years of Experience must be a number between 0 and 60';
    }

    if (Object.keys(errors).length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Validation failed. Please correct the highlighted errors.',
        errors
      });
    }

    const existingUser = await User.findOne({ userId: cleanTeacherId }).session(session);
    const existingTeacher = await TeacherProfile.findOne({ teacherId: cleanTeacherId }).session(session);
    if (existingUser || existingTeacher) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Teacher ID already exists',
        errors: { teacherId: 'Teacher ID already exists' }
      });
    }

    const existingEmail = await TeacherProfile.findOne({
      institution: req.currentUser.institution._id,
      'personalInfo.email': cleanEmail
    }).session(session);
    if (existingEmail) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
        errors: { email: 'Email already exists' }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      institution: req.currentUser.institution._id,
      userId: cleanTeacherId,
      password: hashedPassword,
      role: 'teacher',
      name: cleanName,
      mustChangePassword: true,
      isActive: isActive !== undefined ? isActive : true,
      qualifications: cleanQualifications,
      highestQualification: cleanQualification
    });
    await user.save({ session });

    const teacherProfile = new TeacherProfile({
      institution: req.currentUser.institution._id,
      user: user._id,
      teacherId: cleanTeacherId,
      department: cleanDepartment,
      departmentRef: targetDeptDoc ? targetDeptDoc._id : undefined,
      designation: cleanDesignation,
      personalInfo: {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress
      },
      professionalInfo: {
        qualifications: cleanQualifications,
        highestQualification: cleanQualification,
        specialization: cleanSpecialization,
        yearsOfExperience: Number(expValue)
      }
    });
    await teacherProfile.save({ session });

    // Handle teaching assignments if provided (optional for backwards compatibility)
    if (teachingAssignments && Array.isArray(teachingAssignments) && teachingAssignments.length > 0) {
      const assignmentsToInsert = teachingAssignments.map(ta => ({
        institution: req.currentUser.institution._id,
        teacher: teacherProfile._id,
        subject: ta.subjectId,
        classRef: ta.classId,
        academicYear: ta.academicYear
      }));
      await TeachingAssignment.insertMany(assignmentsToInsert, { session });
    }

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'CREATE_TEACHER', user._id, 'User', { teacherId: cleanTeacherId });

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: `New Teacher Onboarded: ${cleanName}`,
      message: `Faculty account for ${cleanName} (ID: ${cleanTeacherId}) was created under ${cleanDepartment} as ${cleanDesignation}.`,
      category: 'teachers',
      severity: 'success',
      relatedEntityType: 'TeacherProfile',
      relatedEntityId: teacherProfile._id,
      destinationUrl: `/admin/teachers/${teacherProfile._id}`,
      eventKey: `CREATE_TEACHER_${cleanTeacherId}`
    });

    res.status(201).json({ success: true, message: 'Teacher created successfully', teacherId: cleanTeacherId, teacher: ensureTeacherQualifications(teacherProfile) });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to create teacher' });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await TeacherProfile.find({ institution: req.currentUser.institution._id })
      .populate('user', 'userId name role isActive createdAt mustChangePassword')
      .populate('departmentRef', 'name code');
    res.status(200).json({ success: true, teachers: teachers.map(ensureTeacherQualifications) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch teachers' });
  }
};

exports.getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    const teacher = await TeacherProfile.findOne({
      _id: id,
      institution: req.currentUser.institution._id
    })
      .populate('user', 'userId name role isActive createdAt mustChangePassword')
      .populate('departmentRef', 'name code');

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    res.status(200).json({ success: true, teacher: ensureTeacherQualifications(teacher) });
  } catch (error) {
    console.error('Error fetching teacher by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teacher' });
  }
};

exports.updateTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { personalInfo, professionalInfo, department, designation } = req.body;

    const teacherProfile = await TeacherProfile.findOne({
      _id: id,
      institution: req.currentUser.institution._id
    }).session(session);

    if (!teacherProfile) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    const errors = {};

    const rawName = (personalInfo && personalInfo.name) || req.body.name || '';
    const cleanName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!cleanName) {
      errors.name = 'Full Name is required';
    }

    const rawEmail = (personalInfo && personalInfo.email) || req.body.email || '';
    const cleanEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!cleanEmail) {
      errors.email = 'Email Address is required';
    } else if (!validateEmailFormat(cleanEmail)) {
      errors.email = 'Please provide a valid email address';
    }

    const rawPhone = (personalInfo && personalInfo.phone) || req.body.phone || '';
    const cleanPhone = typeof rawPhone === 'string' ? rawPhone.trim() : '';
    if (!cleanPhone) {
      errors.phone = 'Phone Number is required';
    } else if (!validatePhoneFormat(cleanPhone)) {
      errors.phone = 'Please provide a valid 10-digit phone number';
    }

    const rawAddress = (personalInfo && personalInfo.address) || req.body.address || '';
    const cleanAddress = typeof rawAddress === 'string' ? rawAddress.trim() : '';
    if (!cleanAddress) {
      errors.address = 'Address is required';
    }

    let cleanDepartment = department && typeof department === 'string' ? department.trim() : (department ? String(department).trim() : '');
    let targetDeptDoc = null;
    if (cleanDepartment && mongoose.Types.ObjectId.isValid(cleanDepartment) && /^[0-9a-fA-F]{24}$/.test(cleanDepartment)) {
      targetDeptDoc = await Department.findOne({ _id: cleanDepartment, institution: req.currentUser.institution._id }).session(session);
      if (!targetDeptDoc) {
        errors.department = 'Referenced department does not exist in this institution.';
      } else {
        cleanDepartment = targetDeptDoc.name;
      }
    } else if (cleanDepartment) {
      targetDeptDoc = await Department.findOne({
        institution: req.currentUser.institution._id,
        $or: [
          { name: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') },
          { code: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') }
        ]
      }).session(session);
      if (targetDeptDoc) {
        cleanDepartment = targetDeptDoc.name;
      }
    }
    if (!cleanDepartment || cleanDepartment.toLowerCase().startsWith('select')) {
      errors.department = 'Department is required';
    }

    const cleanDesignation = designation && typeof designation === 'string' ? designation.trim() : '';
    if (!cleanDesignation || cleanDesignation.toLowerCase().startsWith('select')) {
      errors.designation = 'Designation is required';
    }

    const cleanQualifications = normalizeQualifications(req.body);
    if (cleanQualifications.length === 0) {
      errors.qualifications = 'Qualification is required';
      errors.highestQualification = 'Qualification is required';
    }
    const cleanQualification = cleanQualifications.join(', ');

    const rawSpec = (professionalInfo && professionalInfo.specialization) || req.body.specialization || '';
    const cleanSpecialization = typeof rawSpec === 'string' ? rawSpec.trim() : '';
    if (!cleanSpecialization || cleanSpecialization.toLowerCase().startsWith('select')) {
      errors.specialization = 'Specialization is required';
    }

    const expValue = (professionalInfo && professionalInfo.yearsOfExperience !== undefined) ? professionalInfo.yearsOfExperience : req.body.yearsOfExperience;
    if (expValue === undefined || expValue === null || expValue === '' || String(expValue).trim() === '') {
      errors.yearsOfExperience = 'Years of Experience is required';
    } else if (!validateExperience(expValue)) {
      errors.yearsOfExperience = 'Years of Experience must be a number between 0 and 60';
    }

    if (Object.keys(errors).length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Validation failed. Please correct the highlighted errors.',
        errors
      });
    }

    // Check email uniqueness excluding this teacher
    const existingEmail = await TeacherProfile.findOne({
      _id: { $ne: teacherProfile._id },
      institution: req.currentUser.institution._id,
      'personalInfo.email': cleanEmail
    }).session(session);

    const existingUserEmail = await User.findOne({
      _id: { $ne: teacherProfile.user },
      institution: req.currentUser.institution._id,
      email: cleanEmail
    }).session(session);

    if (existingEmail || existingUserEmail) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Email already exists or is in use by another account',
        errors: { email: 'Email already exists or is in use by another account' }
      });
    }

    // Update TeacherProfile
    teacherProfile.department = cleanDepartment;
    if (targetDeptDoc) teacherProfile.departmentRef = targetDeptDoc._id;
    teacherProfile.designation = cleanDesignation;
    if (!teacherProfile.personalInfo) teacherProfile.personalInfo = {};
    teacherProfile.personalInfo.name = cleanName;
    teacherProfile.personalInfo.email = cleanEmail;
    teacherProfile.personalInfo.phone = cleanPhone;
    teacherProfile.personalInfo.address = cleanAddress;

    if (!teacherProfile.professionalInfo) teacherProfile.professionalInfo = {};
    teacherProfile.professionalInfo.qualifications = cleanQualifications;
    teacherProfile.professionalInfo.highestQualification = cleanQualification;
    teacherProfile.professionalInfo.specialization = cleanSpecialization;
    teacherProfile.professionalInfo.yearsOfExperience = Number(expValue);

    await teacherProfile.save({ session });

    // Update user name without touching password, role, or isActive
    const user = await User.findById(teacherProfile.user).session(session);
    if (user) {
      user.name = cleanName;
      user.qualifications = cleanQualifications;
      user.highestQualification = cleanQualification;
      await user.save({ session });
    }

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'UPDATE_TEACHER', teacherProfile._id, 'TeacherProfile', { teacherId: teacherProfile.teacherId });

    await session.commitTransaction();
    session.endSession();

    const updatedTeacher = await TeacherProfile.findById(id).populate('user', 'name isActive createdAt mustChangePassword');
    res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      teacher: ensureTeacherQualifications(updatedTeacher)
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to update teacher' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findOne({ _id: id, institution: req.currentUser.institution._id });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    if (user.role === 'admin') {
       return res.status(403).json({ success: false, error: 'Cannot modify admin status via this endpoint' });
    }

    user.isActive = isActive;
    await user.save();
    
    // Destroy sessions if user is deactivated
    if (!isActive) {
      await mongoose.connection.collection('sessions').deleteMany({ 'session.userId': user._id.toString() });
    }

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'UPDATE_USER_STATUS', user._id, 'User', { isActive });

    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: `${user.role === 'teacher' ? 'Faculty' : 'Student'} Account ${isActive ? 'Activated' : 'Deactivated'}`,
      message: `Account for ${user.name || user.userId} (ID: ${user.userId}) was ${isActive ? 'activated' : 'deactivated'}.`,
      category: user.role === 'teacher' ? 'teachers' : 'students',
      severity: isActive ? 'info' : 'warning',
      destinationUrl: user.role === 'teacher' ? '/admin/teachers' : '/admin/students'
    });

    res.status(200).json({ success: true, message: 'User status updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update user status' });
  }
};

exports.adminResetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || !validatePasswordStrength(newPassword)) {
      return res.status(400).json({ success: false, error: 'Password does not meet strength requirements' });
    }

    const user = await User.findOne({ _id: id, institution: req.currentUser.institution._id });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot reset admin password via this endpoint' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = true;
    await user.save();

    // Invalidate all active sessions for this user
    await mongoose.connection.collection('sessions').deleteMany({ 'session.userId': user._id.toString() });

    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'ADMIN_PASSWORD_RESET', user._id, 'User');

    await createNotification({
      institutionId: req.currentUser.institution._id,
      recipientId: req.currentUser._id,
      title: 'Administrative Password Reset',
      message: `Password was reset by administrator for account ID "${user.userId}".`,
      category: 'security_system',
      severity: 'warning',
      destinationUrl: user.role === 'teacher' ? '/admin/teachers' : '/admin/students'
    });

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};

// --- ASSIGNMENT METRICS CALCULATION HELPER ---
/**
 * Calculates accurate academic counts and assignment status based on actual database relationships.
 * - subjectsCount: unique active subjects assigned
 * - teachersCount: unique active teachers assigned
 * - status: 'Assigned' ONLY if at least 1 valid subject is assigned, at least 1 valid teacher is assigned,
 *   every assigned subject has at least 1 valid teacher, and no relationships are broken or inactive.
 *   Otherwise 'Not Assigned'.
 */
function calculateAssignmentMetrics(assignments = []) {
  const activeAssignments = (assignments || []).filter(a => a && a.isActive !== false);

  const subjectMap = new Map(); // subjectId -> { subject, teachers: Set<teacherId> }
  const uniqueTeachers = new Set();
  let hasIncompleteOrBroken = false;

  for (const asgn of activeAssignments) {
    const subjectId = asgn.subject?._id?.toString() || (asgn.subject ? asgn.subject.toString() : null);
    const teacherId = asgn.teacher?._id?.toString() || (asgn.teacher ? asgn.teacher.toString() : null);

    const isSubjectValid = Boolean(subjectId && asgn.subject?.isActive !== false);
    const isTeacherValid = Boolean(teacherId && asgn.teacher?.isActive !== false && (asgn.teacher?.user ? asgn.teacher.user.isActive !== false : true));

    if (!isSubjectValid) {
      hasIncompleteOrBroken = true;
      continue;
    }

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        subject: asgn.subject,
        teachers: new Set()
      });
    }

    if (isTeacherValid) {
      subjectMap.get(subjectId).teachers.add(teacherId);
      uniqueTeachers.add(teacherId);
    } else {
      hasIncompleteOrBroken = true;
    }
  }

  const subjectsCount = subjectMap.size;
  const teachersCount = uniqueTeachers.size;

  let allSubjectsHaveTeachers = subjectsCount > 0;
  for (const info of subjectMap.values()) {
    if (info.teachers.size === 0) {
      allSubjectsHaveTeachers = false;
      break;
    }
  }

  const isAssigned = (
    subjectsCount > 0 &&
    teachersCount > 0 &&
    allSubjectsHaveTeachers &&
    !hasIncompleteOrBroken
  );

  const status = isAssigned ? 'Assigned' : 'Not Assigned';

  return {
    subjectsCount,
    teachersCount,
    status,
    isAssigned,
    hasPendingAssignments: !isAssigned
  };
}

// --- CLASSES & SECTIONS / STUDENT GROUPS ---
exports.getClasses = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const classes = await Class.find({ institution: institutionId })
      .populate('departmentRef', 'name code')
      .sort({ academicYear: -1, course: 1, department: 1, semester: 1, section: 1 });

    const classIds = classes.map(c => c._id);

    // Count students enrolled in each group
    const studentCounts = await StudentProfile.aggregate([
      { $match: { institution: institutionId, classRef: { $in: classIds } } },
      { $group: { _id: '$classRef', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    studentCounts.forEach(sc => {
      if (sc._id) countMap[sc._id.toString()] = sc.count;
    });

    // Fetch active assignments for each group
    const assignments = await TeachingAssignment.find({
      institution: institutionId,
      classRef: { $in: classIds },
      isActive: true
    })
      .populate('subject', 'name code credits department subjectType semester isActive')
      .populate({
        path: 'teacher',
        select: 'teacherId department designation personalInfo professionalInfo user',
        populate: { path: 'user', select: 'name email isActive' }
      });

    const assignmentsMap = {};
    assignments.forEach(a => {
      const cid = a.classRef.toString();
      if (!assignmentsMap[cid]) assignmentsMap[cid] = [];
      assignmentsMap[cid].push(a);
    });

    const enrichedClasses = classes.map(c => {
      const cid = c._id.toString();
      const groupAssignments = assignmentsMap[cid] || [];
      const derivedYear = normalizeYearOfStudy(c.yearOfStudy, c.semester);
      const metrics = calculateAssignmentMetrics(groupAssignments);
      return {
        ...c.toObject(),
        yearOfStudy: c.yearOfStudy || derivedYear,
        studentCount: countMap[cid] || 0,
        assignments: groupAssignments,
        assignmentCount: groupAssignments.length,
        subjectsCount: metrics.subjectsCount,
        teachersCount: metrics.teachersCount,
        hasPendingAssignments: metrics.hasPendingAssignments,
        status: metrics.status
      };
    });

    // Distinct actual enrolled students counted without duplication
    const enrolledStudentIds = await StudentProfile.distinct('_id', {
      institution: institutionId,
      classRef: { $in: classIds }
    });

    res.status(200).json({
      success: true,
      classes: enrichedClasses,
      totalEnrolledStudents: enrolledStudentIds.length
    });
  } catch (error) {
    console.error('getClasses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch classes' });
  }
};

exports.getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid class ID' });
    }

    const classDoc = await Class.findOne({ _id: id, institution: institutionId }).populate('departmentRef', 'name code');
    if (!classDoc) {
      return res.status(404).json({ success: false, error: 'Group / Class not found' });
    }

    // Fetch enrolled students - strictly enforced on backend by classRef and institution
    const students = await StudentProfile.find({ classRef: id, institution: institutionId })
      .populate('user', 'userId name email role isActive createdAt mustChangePassword');

    // Fetch assigned subjects & teachers
    const assignments = await TeachingAssignment.find({ classRef: id, institution: institutionId, isActive: true })
      .populate('subject', 'name code credits department subjectType semester isActive')
      .populate({
        path: 'teacher',
        select: 'teacherId department designation personalInfo professionalInfo user',
        populate: { path: 'user', select: 'name email isActive' }
      });

    const metrics = calculateAssignmentMetrics(assignments);
    res.status(200).json({
      success: true,
      class: {
        ...classDoc.toObject(),
        yearOfStudy: classDoc.yearOfStudy || normalizeYearOfStudy(null, classDoc.semester),
        studentCount: students.length,
        students,
        assignments,
        assignmentCount: assignments.length,
        subjectsCount: metrics.subjectsCount,
        teachersCount: metrics.teachersCount,
        hasPendingAssignments: metrics.hasPendingAssignments,
        status: metrics.status
      }
    });
  } catch (error) {
    console.error('getClassById error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch class details' });
  }
};

exports.updateClassAssignments = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;
    const { assignments } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Invalid class ID' });
    }

    const classDoc = await Class.findOne({ _id: id, institution: institutionId }).session(session);
    if (!classDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Group / Class not found' });
    }

    if (!Array.isArray(assignments)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Assignments must be provided as an array' });
    }

    const seenSubjects = new Set();
    const assignmentsToInsert = [];

    for (let i = 0; i < assignments.length; i++) {
      const item = assignments[i];
      const { subjectId, teacherId } = item;

      if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Valid subject is required.` });
      }

      let teacherDoc = null;
      if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
        teacherDoc = await TeacherProfile.findOne({ _id: teacherId, institution: institutionId }).populate('user').session(session);
        if (!teacherDoc) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: `Row ${i + 1}: Teacher not found in this institution.` });
        }
        if (teacherDoc.user && teacherDoc.user.isActive === false) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: `Row ${i + 1}: Teacher account is deactivated.` });
        }
      }

      const subStr = subjectId.toString();
      if (seenSubjects.has(subStr)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: 'A subject cannot be assigned more than once to the same group.' });
      }
      seenSubjects.add(subStr);

      // Validate subject is active and belongs to institution
      const subjectDoc = await Subject.findOne({ _id: subjectId, institution: institutionId }).session(session);
      if (!subjectDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Subject not found in this institution.` });
      }
      if (subjectDoc.isActive === false) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Subject "${subjectDoc.name}" is inactive.` });
      }

      assignmentsToInsert.push({
        institution: institutionId,
        classRef: classDoc._id,
        subject: subjectDoc._id,
        teacher: teacherDoc ? teacherDoc._id : null,
        academicYear: classDoc.academicYear,
        isActive: true
      });
    }

    // Atomic wipe & replace assignments for this group
    await TeachingAssignment.deleteMany({ classRef: classDoc._id, institution: institutionId }).session(session);

    if (assignmentsToInsert.length > 0) {
      await TeachingAssignment.insertMany(assignmentsToInsert, { session });
    }

    await logAudit(institutionId, req.currentUser._id, 'UPDATE_GROUP_ASSIGNMENTS', classDoc._id, 'Class', {
      assignmentCount: assignmentsToInsert.length,
      academicYear: classDoc.academicYear,
      department: classDoc.department,
      semester: classDoc.semester,
      section: classDoc.section
    });

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      institutionId,
      recipientId: req.currentUser._id,
      title: `Teaching Assignments Updated: Section ${classDoc.section}`,
      message: `${assignmentsToInsert.length} subject-teacher assignment(s) configured for ${classDoc.department} Section ${classDoc.section}.`,
      category: 'teachers',
      severity: 'success',
      destinationUrl: '/admin/classes'
    });

    if (assignmentsToInsert.some(a => !a.teacher)) {
      await createNotification({
        institutionId,
        recipientId: req.currentUser._id,
        title: `Incomplete Faculty Assignments: Section ${classDoc.section}`,
        message: `Section ${classDoc.section} (${classDoc.department}) has subject(s) with no teacher assigned.`,
        category: 'teachers',
        severity: 'warning',
        destinationUrl: '/admin/classes'
      });
    }

    // Fetch refreshed assignments
    const updatedAssignments = await TeachingAssignment.find({ classRef: classDoc._id, institution: institutionId, isActive: true })
      .populate('subject', 'name code credits department subjectType semester isActive')
      .populate({
        path: 'teacher',
        select: 'teacherId department designation personalInfo professionalInfo user',
        populate: { path: 'user', select: 'name email isActive' }
      });

    const metrics = calculateAssignmentMetrics(updatedAssignments);

    return res.status(200).json({
      success: true,
      message: `Group assignments updated successfully (${metrics.subjectsCount} subject(s), ${metrics.teachersCount} teacher(s)).`,
      assignments: updatedAssignments,
      assignmentCount: updatedAssignments.length,
      subjectsCount: metrics.subjectsCount,
      teachersCount: metrics.teachersCount,
      hasPendingAssignments: metrics.hasPendingAssignments,
      status: metrics.status
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updateClassAssignments error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update group assignments.' });
  }
};

/**
 * @desc Create a new section/class under an academic year and department
 */
exports.createClass = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const { course, department, academicYear, semester, section, yearOfStudy } = req.body;

    const errors = {};
    const cleanCourse = course && typeof course === 'string' ? course.trim() : '';
    const cleanDepartment = department && typeof department === 'string' ? department.trim() : '';
    const cleanAcademicYear = academicYear && typeof academicYear === 'string' ? academicYear.trim() : '';
    const cleanSemester = semester !== undefined && semester !== null ? String(semester).trim() : '';
    const cleanSection = section && typeof section === 'string' ? section.trim() : '';

    if (!cleanCourse) errors.course = 'Course / Program is required';
    if (!cleanDepartment) errors.department = 'Department is required';
    if (!cleanAcademicYear) errors.academicYear = 'Academic Calendar Year is required';
    if (!cleanSemester) errors.semester = 'Semester is required';
    if (!cleanSection) errors.section = 'Section identifier is required';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed. Please correct all highlighted fields.',
        errors
      });
    }

    const normalizedYear = normalizeYearOfStudy(yearOfStudy, cleanSemester);
    // Strip redundant "Section " if user entered "Section A" vs "A"
    const normalizedSection = cleanSection.replace(/^section\s+/i, '').trim();

    // Resolve department document
    let deptDoc = null;
    if (mongoose.Types.ObjectId.isValid(cleanDepartment)) {
      deptDoc = await Department.findOne({ _id: cleanDepartment, institution: institutionId });
    }
    if (!deptDoc) {
      deptDoc = await Department.findOne({
        institution: institutionId,
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') } },
          { code: { $regex: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') } }
        ]
      });
    }
    const resolvedDeptName = deptDoc ? deptDoc.name : cleanDepartment;
    const resolvedDeptRef = deptDoc ? deptDoc._id : undefined;

    // Check for existing class/group (case-insensitive section matching)
    const existing = await Class.findOne({
      institution: institutionId,
      course: cleanCourse,
      department: resolvedDeptName,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      section: { $regex: new RegExp(`^(Section\\s*)?${normalizedSection}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Section "${normalizedSection}" already exists in ${resolvedDeptName} for Semester ${cleanSemester} (${cleanAcademicYear}).`,
        errors: { section: 'Section already exists in this academic group.' }
      });
    }

    const groupName = `${cleanCourse} - ${resolvedDeptName} (Sem ${cleanSemester}, Sec ${normalizedSection})`;
    const newClass = new Class({
      institution: institutionId,
      name: groupName,
      course: cleanCourse,
      department: resolvedDeptName,
      departmentRef: resolvedDeptRef,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      section: normalizedSection,
      yearOfStudy: normalizedYear,
      isActive: true
    });

    await newClass.save();

    await logAudit(institutionId, req.currentUser._id, 'CREATE_CLASS', newClass._id, 'Class', {
      name: groupName,
      course: cleanCourse,
      department: cleanDepartment,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      section: normalizedSection,
      yearOfStudy: normalizedYear
    });

    await createNotification({
      institutionId,
      recipientId: req.currentUser._id,
      title: `New Section Created: ${normalizedSection}`,
      message: `Section "${normalizedSection}" was created under ${cleanDepartment} (${cleanAcademicYear}, Semester ${cleanSemester}).`,
      category: 'departments_sections',
      severity: 'success',
      relatedEntityType: 'Class',
      relatedEntityId: newClass._id,
      destinationUrl: '/admin/classes',
      eventKey: `CREATE_SECTION_${newClass._id}`
    });

    return res.status(201).json({
      success: true,
      message: `Section "${normalizedSection}" created successfully in ${cleanDepartment}.`,
      class: {
        ...newClass.toObject(),
        yearOfStudy: normalizedYear,
        studentCount: 0,
        assignments: [],
        assignmentCount: 0,
        subjectsCount: 0,
        teachersCount: 0,
        hasPendingAssignments: true,
        status: 'Not Assigned'
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'A section with these academic parameters already exists in the institution.'
      });
    }
    console.error('createClass error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create section / class' });
  }
};

/**
 * @desc Update an existing section/class details
 */
exports.updateClass = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;
    const { course, department, academicYear, semester, section, yearOfStudy, isActive, name, assignments } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Invalid section ID' });
    }

    const classDoc = await Class.findOne({ _id: id, institution: institutionId }).session(session);
    if (!classDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    const cleanCourse = course && typeof course === 'string' ? course.trim() : classDoc.course;
    const cleanDepartment = department && typeof department === 'string' ? department.trim() : classDoc.department;
    const cleanAcademicYear = academicYear && typeof academicYear === 'string' ? academicYear.trim() : classDoc.academicYear;
    const cleanSemester = semester !== undefined && semester !== null ? String(semester).trim() : classDoc.semester;
    const cleanSection = section && typeof section === 'string' ? section.trim() : classDoc.section;

    const errors = {};
    if (!cleanCourse) errors.course = 'Course / Program is required';
    if (!cleanDepartment) errors.department = 'Department is required';
    if (!cleanAcademicYear) errors.academicYear = 'Academic Year is required';
    if (!cleanSemester) errors.semester = 'Semester is required';
    if (!cleanSection) errors.section = 'Section identifier is required';

    if (Object.keys(errors).length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Validation failed. Please correct all highlighted fields.',
        errors
      });
    }

    const normalizedYear = normalizeYearOfStudy(yearOfStudy || classDoc.yearOfStudy, cleanSemester);
    const normalizedSection = cleanSection.replace(/^section\s+/i, '').trim();

    // Resolve department document
    let deptDoc = null;
    if (mongoose.Types.ObjectId.isValid(cleanDepartment)) {
      deptDoc = await Department.findOne({ _id: cleanDepartment, institution: institutionId }).session(session);
    }
    if (!deptDoc) {
      deptDoc = await Department.findOne({
        institution: institutionId,
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') } },
          { code: { $regex: new RegExp(`^${escapeRegex(cleanDepartment)}$`, 'i') } }
        ]
      }).session(session);
    }
    const resolvedDeptName = deptDoc ? deptDoc.name : cleanDepartment;
    const resolvedDeptRef = deptDoc ? deptDoc._id : undefined;

    // Check for duplicate class in same institution across department, academicYear, semester, and section
    const existing = await Class.findOne({
      _id: { $ne: classDoc._id },
      institution: institutionId,
      course: cleanCourse,
      department: resolvedDeptName,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      section: { $regex: new RegExp(`^(Section\\s*)?${normalizedSection}$`, 'i') }
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Section "${normalizedSection}" already exists in ${resolvedDeptName} for Semester ${cleanSemester} (${cleanAcademicYear}).`,
        errors: { section: 'Section already exists in this academic group.' }
      });
    }

    const oldClass = {
      course: classDoc.course,
      department: classDoc.department,
      academicYear: classDoc.academicYear,
      semester: classDoc.semester,
      section: classDoc.section,
      isActive: classDoc.isActive
    };

    classDoc.course = cleanCourse;
    classDoc.department = resolvedDeptName;
    if (resolvedDeptRef) classDoc.departmentRef = resolvedDeptRef;
    classDoc.academicYear = cleanAcademicYear;
    classDoc.semester = cleanSemester;
    classDoc.section = normalizedSection;
    classDoc.yearOfStudy = normalizedYear;
    if (typeof isActive === 'boolean') {
      classDoc.isActive = isActive;
    }
    classDoc.name = name && typeof name === 'string' && name.trim()
      ? name.trim()
      : `${cleanCourse} - ${resolvedDeptName} (Sem ${cleanSemester}, Sec ${normalizedSection})`;
    await classDoc.save({ session });

    // Synchronize enrolled students' profiles
    const studentUpdatePayload = {
      course: cleanCourse,
      department: resolvedDeptName,
      academicYear: cleanAcademicYear,
      semester: cleanSemester,
      section: normalizedSection,
      yearOfStudy: normalizedYear
    };
    if (resolvedDeptRef) {
      studentUpdatePayload.departmentRef = resolvedDeptRef;
    }
    await StudentProfile.updateMany(
      { classRef: classDoc._id, institution: institutionId },
      { $set: studentUpdatePayload },
      { session }
    );

    // If department changed, synchronize user department for enrolled students
    if (cleanDepartment !== oldClass.department) {
      const studentProfiles = await StudentProfile.find({ classRef: classDoc._id, institution: institutionId }).session(session);
      const studentUserIds = studentProfiles.map(s => s.user).filter(Boolean);
      if (studentUserIds.length > 0) {
        await User.updateMany(
          { _id: { $in: studentUserIds }, institution: institutionId },
          { $set: { department: cleanDepartment } },
          { session }
        );
      }
    }

    // Synchronize teaching assignments academicYear
    await TeachingAssignment.updateMany(
      { classRef: classDoc._id, institution: institutionId },
      { $set: { academicYear: cleanAcademicYear } },
      { session }
    );

    // If assignments array is provided in request, update assignments atomically
    if (Array.isArray(assignments)) {
      await TeachingAssignment.deleteMany({ classRef: classDoc._id, institution: institutionId }, { session });
      const newAssignments = [];
      const seenSubjects = new Set();
      for (const a of assignments) {
        if (!a.subjectId) continue;
        if (seenSubjects.has(a.subjectId.toString())) continue;
        seenSubjects.add(a.subjectId.toString());

        const sub = await Subject.findOne({ _id: a.subjectId, institution: institutionId }).session(session);
        if (!sub) continue;

        let teacherDoc = null;
        if (a.teacherId) {
          teacherDoc = await TeacherProfile.findOne({ _id: a.teacherId, institution: institutionId }).session(session);
        }

        newAssignments.push({
          institution: institutionId,
          classRef: classDoc._id,
          subject: sub._id,
          teacher: teacherDoc ? teacherDoc._id : null,
          academicYear: cleanAcademicYear,
          status: 'Active',
          isActive: true
        });
      }
      if (newAssignments.length > 0) {
        await TeachingAssignment.insertMany(newAssignments, { session });
      }
    }

    await logAudit(institutionId, req.currentUser._id, 'UPDATE_CLASS', classDoc._id, 'Class', {
      old: oldClass,
      updated: {
        course: cleanCourse,
        department: cleanDepartment,
        academicYear: cleanAcademicYear,
        semester: cleanSemester,
        section: normalizedSection,
        isActive: classDoc.isActive
      }
    });

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      institutionId,
      recipientId: req.currentUser._id,
      title: `Section Updated: ${normalizedSection}`,
      message: `Section details for "${normalizedSection}" (${cleanDepartment}) were successfully updated.`,
      category: 'departments_sections',
      severity: 'info',
      relatedEntityType: 'Class',
      relatedEntityId: classDoc._id,
      destinationUrl: '/admin/classes'
    });

    // Fetch updated counts
    const updatedStudentCount = await StudentProfile.countDocuments({ classRef: classDoc._id, institution: institutionId });
    const updatedAssignments = await TeachingAssignment.find({ classRef: classDoc._id, institution: institutionId, isActive: true })
      .populate('subject', 'name code credits department semester')
      .populate({
        path: 'teacher',
        select: 'teacherId department designation personalInfo user',
        populate: { path: 'user', select: 'name email' }
      });

    const metrics = calculateAssignmentMetrics(updatedAssignments);

    return res.status(200).json({
      success: true,
      message: `Section "${normalizedSection}" updated successfully.`,
      class: {
        ...classDoc.toObject(),
        studentCount: updatedStudentCount,
        assignmentCount: updatedAssignments.length,
        assignments: updatedAssignments,
        subjectsCount: metrics.subjectsCount,
        teachersCount: metrics.teachersCount,
        hasPendingAssignments: metrics.hasPendingAssignments,
        status: metrics.status
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updateClass error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update section' });
  }
};

/**
 * @desc Batch update department across sections
 */
exports.updateDepartmentBatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const institutionId = req.currentUser.institution._id;
    const { oldDepartment, newDepartment, course, academicYear } = req.body;

    if (!oldDepartment || !newDepartment || !newDepartment.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Both old and new department names are required.' });
    }

    const cleanOld = oldDepartment.trim();
    const cleanNew = newDepartment.trim();

    const query = {
      institution: institutionId,
      department: cleanOld
    };
    if (course) query.course = course.trim();
    if (academicYear) query.academicYear = academicYear.trim();

    const classesToUpdate = await Class.find(query).session(session);
    if (classesToUpdate.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'No matching sections found for this department.' });
    }

    const classIds = classesToUpdate.map(c => c._id);

    for (const cls of classesToUpdate) {
      cls.department = cleanNew;
      cls.name = `${cls.course} - ${cleanNew} (Sem ${cls.semester}, Sec ${cls.section})`;
      await cls.save({ session });
    }

    // Update enrolled students
    await StudentProfile.updateMany(
      { classRef: { $in: classIds }, institution: institutionId },
      { $set: { department: cleanNew } },
      { session }
    );

    await logAudit(institutionId, req.currentUser._id, 'BATCH_UPDATE_DEPARTMENT', null, 'Class', {
      oldDepartment: cleanOld,
      newDepartment: cleanNew,
      sectionsUpdated: classesToUpdate.length
    });

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      institutionId,
      recipientId: req.currentUser._id,
      title: `Department Updated: ${cleanNew}`,
      message: `Department was renamed from "${cleanOld}" to "${cleanNew}" across ${classesToUpdate.length} section(s).`,
      category: 'departments_sections',
      severity: 'info',
      destinationUrl: '/admin/classes'
    });

    return res.status(200).json({
      success: true,
      message: `Department updated to "${cleanNew}" across ${classesToUpdate.length} section(s).`,
      sectionsUpdated: classesToUpdate.length
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updateDepartmentBatch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update department' });
  }
};

/**
 * @desc Explicitly reconcile students without valid classRef against configured sections
 */
exports.reconcileStudentGroups = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const allStudents = await StudentProfile.find({ institution: institutionId });
    const classes = await Class.find({ institution: institutionId, isActive: true });

    let reconciledCount = 0;
    const reconciledStudents = [];
    const unmatchedStudents = [];

    for (const student of allStudents) {
      let hasValidClass = false;
      if (student.classRef) {
        hasValidClass = classes.some(c => c._id.toString() === student.classRef.toString());
      }

      if (!hasValidClass) {
        const matchedClass = classes.find(c =>
          c.course.toLowerCase().trim() === (student.course || '').toLowerCase().trim() &&
          isDeptMatch(c.department, student.department) &&
          isSemMatch(c.semester, student.semester) &&
          isSecMatch(c.section, student.section)
        );

        if (matchedClass) {
          student.classRef = matchedClass._id;
          student.department = matchedClass.department;
          student.section = matchedClass.section;
          student.yearOfStudy = matchedClass.yearOfStudy || normalizeYearOfStudy(null, matchedClass.semester);
          await student.save();
          reconciledCount++;
          reconciledStudents.push({
            studentId: student.studentId,
            name: student.personalInfo?.name || student.studentId,
            department: matchedClass.department,
            section: matchedClass.section,
            semester: matchedClass.semester
          });
        } else {
          unmatchedStudents.push({
            studentId: student.studentId,
            name: student.personalInfo?.name || student.studentId,
            course: student.course,
            department: student.department,
            semester: student.semester,
            section: student.section,
            reason: 'No configured section found matching these academic details'
          });
        }
      }
    }

    if (reconciledCount > 0) {
      await logAudit(institutionId, req.currentUser._id, 'RECONCILE_STUDENTS', null, 'StudentProfile', {
        reconciledCount,
        unmatchedCount: unmatchedStudents.length
      });
    }

    return res.status(200).json({
      success: true,
      message: `Reconciliation completed: ${reconciledCount} student(s) successfully assigned to their configured sections. ${unmatchedStudents.length} student(s) unassigned.`,
      reconciledCount,
      unmatchedCount: unmatchedStudents.length,
      reconciledStudents,
      unmatchedStudents
    });
  } catch (error) {
    console.error('reconcileStudentGroups error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reconcile students' });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ institution: req.currentUser.institution._id })
      .populate('departmentRef', 'name code')
      .sort({ name: 1 });
    res.status(200).json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch subjects' });
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, department, description, subjectType, credits, semester, academicYear, isActive } = req.body;
    
    // Validate required fields
    if (!name || !code || !department) {
      return res.status(400).json({ success: false, error: 'Name, code, and department are required' });
    }

    const trimmedCode = code.trim();
    
    // Check for duplicate code
    const existingSubject = await Subject.findOne({ institution: req.currentUser.institution._id, code: trimmedCode });
    if (existingSubject) {
      return res.status(400).json({ success: false, error: 'Subject code already exists' });
    }

    let cleanDept = typeof department === 'string' ? department.trim() : String(department).trim();
    let deptDoc = null;
    if (mongoose.Types.ObjectId.isValid(cleanDept) && /^[0-9a-fA-F]{24}$/.test(cleanDept)) {
      deptDoc = await Department.findOne({ _id: cleanDept, institution: req.currentUser.institution._id });
      if (deptDoc) {
        cleanDept = deptDoc.name;
      }
    } else {
      deptDoc = await Department.findOne({
        institution: req.currentUser.institution._id,
        $or: [
          { name: new RegExp(`^${escapeRegex(cleanDept)}$`, 'i') },
          { code: new RegExp(`^${escapeRegex(cleanDept)}$`, 'i') }
        ]
      });
      if (deptDoc) {
        cleanDept = deptDoc.name;
      }
    }

    const subject = new Subject({
      institution: req.currentUser.institution._id,
      name: name.trim(),
      code: trimmedCode,
      department: cleanDept,
      departmentRef: deptDoc ? deptDoc._id : undefined,
      description: description ? description.trim() : '',
      subjectType: subjectType || 'Theory',
      credits: credits ? Number(credits) : undefined,
      semester,
      academicYear,
      isActive: isActive !== false
    });

    await subject.save();
    
    // Log creation
    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'CREATE_SUBJECT', subject._id, 'Subject', { code: trimmedCode });

    res.status(201).json({ success: true, message: 'Subject created successfully', subject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Subject code already exists' });
    }
    console.error('Error creating subject:', error);
    res.status(500).json({ success: false, error: 'Failed to create subject' });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, department, description, subjectType, credits, semester, academicYear } = req.body;
    
    if (!name || !code || !department) {
      return res.status(400).json({ success: false, error: 'Name, code, and department are required' });
    }

    const trimmedCode = code.trim();
    
    const subject = await Subject.findOne({ _id: id, institution: req.currentUser.institution._id });
    if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

    // Check duplicate code if code changed
    if (trimmedCode !== subject.code) {
      const existing = await Subject.findOne({ institution: req.currentUser.institution._id, code: trimmedCode });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Subject code already exists' });
      }
    }

    let cleanDept = typeof department === 'string' ? department.trim() : String(department).trim();
    let deptDoc = null;
    if (mongoose.Types.ObjectId.isValid(cleanDept) && /^[0-9a-fA-F]{24}$/.test(cleanDept)) {
      deptDoc = await Department.findOne({ _id: cleanDept, institution: req.currentUser.institution._id });
      if (deptDoc) {
        cleanDept = deptDoc.name;
      }
    } else {
      deptDoc = await Department.findOne({
        institution: req.currentUser.institution._id,
        $or: [
          { name: new RegExp(`^${escapeRegex(cleanDept)}$`, 'i') },
          { code: new RegExp(`^${escapeRegex(cleanDept)}$`, 'i') }
        ]
      });
      if (deptDoc) {
        cleanDept = deptDoc.name;
      }
    }

    subject.name = name.trim();
    subject.code = trimmedCode;
    subject.department = cleanDept;
    if (deptDoc) subject.departmentRef = deptDoc._id;
    if (description !== undefined) subject.description = description.trim();
    if (subjectType !== undefined) subject.subjectType = subjectType;
    if (credits !== undefined) subject.credits = credits ? Number(credits) : undefined;
    if (semester !== undefined) subject.semester = semester;
    if (academicYear !== undefined) subject.academicYear = academicYear;

    await subject.save();
    
    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'UPDATE_SUBJECT', subject._id, 'Subject', { code: trimmedCode });

    res.status(200).json({ success: true, message: 'Subject updated successfully', subject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Subject code already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update subject' });
  }
};

exports.updateSubjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const subject = await Subject.findOne({ _id: id, institution: req.currentUser.institution._id });
    if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

    // If attempting to deactivate, check dependencies if necessary.
    // For now, allow deactivation since historical records are preserved.
    
    subject.isActive = isActive;
    await subject.save();
    
    await logAudit(req.currentUser.institution._id, req.currentUser._id, 'UPDATE_SUBJECT_STATUS', subject._id, 'Subject', { isActive });

    res.status(200).json({ success: true, message: 'Subject status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update subject status' });
  }
};

/**
 * @desc Permanently delete student record and associated user account with integrity checks
 */
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid student ID.' });
    }

    const student = await StudentProfile.findOne({ _id: id, institution: institutionId });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found.' });
    }

    // Dependency check: Academic records
    const hasAcademicRecords = await AcademicRecord.exists({ student: student._id });
    if (hasAcademicRecords) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete student "${student.studentId}" because academic records exist for this student. Remove or archive the records first to maintain data integrity.`
      });
    }

    // Protected accounts check
    if (student.user) {
      const user = await User.findById(student.user);
      if (user && (user.role === 'admin' || user.role === 'superadmin')) {
        return res.status(403).json({
          success: false,
          error: 'Protected system account cannot be deleted.'
        });
      }
    }

    // Clean up risk prediction records if any
    await RiskPrediction.deleteMany({ student: student._id });

    // Delete student profile and user credentials
    await StudentProfile.findByIdAndDelete(student._id);
    if (student.user) {
      await User.findByIdAndDelete(student.user);
    }

    await logAudit(institutionId, req.currentUser._id, 'DELETE_STUDENT', student._id, 'StudentProfile', {
      studentId: student.studentId,
      name: student.personalInfo?.name
    });

    return res.status(200).json({
      success: true,
      message: `Student "${student.studentId}" was permanently deleted.`
    });
  } catch (error) {
    console.error('deleteStudent error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete student record.' });
  }
};

/**
 * @desc Inspect teacher dependencies (active teaching assignments, grades recorded, eligible substitute teachers)
 * @route GET /api/admin/teachers/:id/dependencies
 */
exports.getTeacherDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid teacher ID format.' });
    }

    const teacher = await TeacherProfile.findOne({ _id: id, institution: institutionId })
      .populate('user', 'userId name email role isActive')
      .populate('departmentRef', 'name code');

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher record not found.' });
    }

    // 1. Fetch all teaching assignments for this teacher
    const assignments = await TeachingAssignment.find({
      teacher: teacher._id,
      institution: institutionId
    })
      .populate('subject', 'name code credits department subjectType semester')
      .populate('classRef', 'name course department semester section academicYear yearOfStudy');

    // 2. Count recorded grades / marks
    let recordedGradesCount = 0;
    if (teacher.user) {
      recordedGradesCount = await AcademicRecord.countDocuments({
        recordedBy: teacher.user._id || teacher.user
      });
    }

    // 3. Find other active teachers in this institution to offer as reassign candidates
    const otherTeachers = await TeacherProfile.find({
      institution: institutionId,
      _id: { $ne: teacher._id }
    })
      .populate({
        path: 'user',
        match: { isActive: true },
        select: 'name email isActive'
      })
      .select('teacherId department designation personalInfo user')
      .sort({ teacherId: 1 });

    const eligibleReassignTeachers = otherTeachers
      .filter(t => t.user && t.user.isActive)
      .map(t => ({
        _id: t._id,
        teacherId: t.teacherId,
        name: t.user?.name || t.personalInfo?.name || t.teacherId,
        department: t.department,
        designation: t.designation
      }));

    return res.status(200).json({
      success: true,
      teacher: {
        _id: teacher._id,
        teacherId: teacher.teacherId,
        name: teacher.user?.name || teacher.personalInfo?.name || teacher.teacherId,
        department: teacher.department,
        designation: teacher.designation,
        isActive: teacher.user?.isActive !== false
      },
      hasDependencies: assignments.length > 0 || recordedGradesCount > 0,
      assignmentCount: assignments.length,
      assignments: assignments.map(a => ({
        _id: a._id,
        subjectName: a.subject?.name || 'Unknown Subject',
        subjectCode: a.subject?.code || '',
        subjectType: a.subject?.subjectType || '',
        className: a.classRef?.name || '',
        course: a.classRef?.course || '',
        department: a.classRef?.department || '',
        semester: a.classRef?.semester || '',
        section: a.classRef?.section || '',
        academicYear: a.academicYear || a.classRef?.academicYear || '',
        isActive: a.isActive !== false
      })),
      recordedGradesCount,
      eligibleReassignTeachers,
      canDeleteDirectly: assignments.length === 0 && recordedGradesCount === 0
    });
  } catch (error) {
    console.error('getTeacherDependencies error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve teacher dependencies.' });
  }
};

/**
 * @desc Delete or deactivate teacher record with safe dependency resolution (reassignment, unassignment, or deactivation)
 * @route DELETE /api/admin/teachers/:id
 */
exports.deleteTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;
    const { action, reassignToTeacherId, unassignAssignments } = { ...(req.query || {}), ...(req.body || {}) };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Invalid teacher ID format.' });
    }

    const teacher = await TeacherProfile.findOne({ _id: id, institution: institutionId })
      .populate('user')
      .session(session);

    if (!teacher) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Teacher record not found.' });
    }

    const teacherName = teacher.user?.name || teacher.personalInfo?.name || teacher.teacherId;

    // Guard: Prevent deletion of protected accounts
    if (teacher.user && (teacher.user.role === 'admin' || teacher.user.role === 'superadmin')) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        error: 'Protected system account cannot be deleted.'
      });
    }

    // Check active teaching assignments
    const assignments = await TeachingAssignment.find({
      teacher: teacher._id,
      institution: institutionId
    }).populate('subject', 'name code').populate('classRef', 'name section semester academicYear').session(session);

    // Check historical recorded grades
    let recordedGradesCount = 0;
    if (teacher.user) {
      recordedGradesCount = await AcademicRecord.countDocuments({
        recordedBy: teacher.user._id
      }).session(session);
    }

    // If teacher has assignments and no resolution method is specified, return dependency details
    if (assignments.length > 0 && !reassignToTeacherId && !unassignAssignments && action !== 'deactivate') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Cannot delete teacher "${teacherName}" (${teacher.teacherId}) because they have ${assignments.length} active teaching assignments. Please review, reassign, or unassign these assignments first.`,
        hasDependencies: true,
        assignmentCount: assignments.length,
        assignments: assignments.map(a => ({
          _id: a._id,
          subjectName: a.subject?.name || '',
          subjectCode: a.subject?.code || '',
          className: a.classRef?.name || '',
          semester: a.classRef?.semester || '',
          section: a.classRef?.section || '',
          academicYear: a.academicYear || a.classRef?.academicYear || ''
        }))
      });
    }

    let resolutionMessage = '';

    // Handle teaching assignments resolution if dependencies exist
    if (assignments.length > 0) {
      if (reassignToTeacherId) {
        if (!mongoose.Types.ObjectId.isValid(reassignToTeacherId)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: 'Invalid substitute teacher ID.' });
        }

        const substitute = await TeacherProfile.findOne({
          _id: reassignToTeacherId,
          institution: institutionId,
          _id: { $ne: teacher._id }
        }).populate('user').session(session);

        if (!substitute || (substitute.user && substitute.user.isActive === false)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: 'Selected substitute teacher is invalid or inactive.' });
        }

        const subName = substitute.user?.name || substitute.personalInfo?.name || substitute.teacherId;
        await TeachingAssignment.updateMany(
          { teacher: teacher._id, institution: institutionId },
          { $set: { teacher: substitute._id } },
          { session }
        );
        resolutionMessage = `and ${assignments.length} assignments were reassigned to ${subName}`;
      } else if (unassignAssignments || action === 'deactivate') {
        await TeachingAssignment.updateMany(
          { teacher: teacher._id, institution: institutionId },
          { $set: { teacher: null } },
          { session }
        );
        resolutionMessage = `and ${assignments.length} assignments were unassigned`;
      }
    }

    // Branch 1: Safe Deactivation / Archival
    if (action === 'deactivate') {
      if (teacher.user) {
        await User.findByIdAndUpdate(teacher.user._id, { isActive: false }, { session });
      }

      await logAudit(institutionId, req.currentUser._id, 'DEACTIVATE_TEACHER', teacher._id, 'TeacherProfile', {
        teacherId: teacher.teacherId,
        name: teacherName,
        assignmentsResolved: assignments.length,
        resolutionMessage
      });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Teacher "${teacherName}" (${teacher.teacherId}) was safely deactivated ${resolutionMessage}.`
      });
    }

    // Branch 2: Permanent Deletion
    // If historical academic grades exist, hard deletion will violate audit logs and grade integrity
    if (recordedGradesCount > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Cannot permanently delete teacher "${teacherName}" because ${recordedGradesCount} student grade records were recorded by this teacher. To preserve academic integrity, please choose "Deactivate Account Instead".`,
        requiresDeactivation: true,
        recordedGradesCount
      });
    }

    // Permanent delete teacher profile and associated user
    await TeacherProfile.findByIdAndDelete(teacher._id, { session });
    if (teacher.user) {
      await User.findByIdAndDelete(teacher.user._id, { session });
    }

    await logAudit(institutionId, req.currentUser._id, 'DELETE_TEACHER', teacher._id, 'TeacherProfile', {
      teacherId: teacher.teacherId,
      name: teacherName,
      assignmentsResolved: assignments.length,
      resolutionMessage
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Teacher "${teacherName}" (${teacher.teacherId}) was permanently deleted ${resolutionMessage}.`
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('deleteTeacher error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete teacher record.' });
  }
};

/**
 * @desc Permanently delete subject with dependency checks
 */
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid subject ID.' });
    }

    const subject = await Subject.findOne({ _id: id, institution: institutionId });
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found.' });
    }

    // Dependency check 1: Teaching assignments
    const hasAssignments = await TeachingAssignment.exists({ subject: subject._id });
    if (hasAssignments) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete subject "${subject.code}" because it is currently assigned to one or more teaching assignments.`
      });
    }

    // Dependency check 2: Academic records
    const hasRecords = await AcademicRecord.exists({ subject: subject._id });
    if (hasRecords) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete subject "${subject.code}" because student academic records exist for this subject.`
      });
    }

    await Subject.findByIdAndDelete(subject._id);

    await logAudit(institutionId, req.currentUser._id, 'DELETE_SUBJECT', subject._id, 'Subject', {
      code: subject.code,
      name: subject.name
    });

    return res.status(200).json({
      success: true,
      message: `Subject "${subject.code} - ${subject.name}" was permanently deleted.`
    });
  } catch (error) {
    console.error('deleteSubject error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete subject.' });
  }
};

/**
 * @desc Permanently delete academic year with dependency checks
 */
exports.deleteAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid academic year ID.' });
    }

    const academicYear = await AcademicYear.findOne({ _id: id, institution: institutionId });
    if (!academicYear) {
      return res.status(404).json({ success: false, error: 'Academic year not found.' });
    }

    // Active status check
    if (academicYear.isActive) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete active academic year "${academicYear.year}". Please set another academic year as active first.`
      });
    }

    // Dependency check 1: Academic records
    const hasRecords = await AcademicRecord.exists({ academicYear: academicYear._id });
    if (hasRecords) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete academic year "${academicYear.year}" because academic records are logged under it.`
      });
    }

    // Dependency check 2: Students enrolled in this year
    const hasStudents = await StudentProfile.exists({ academicYear: academicYear.year, institution: institutionId });
    if (hasStudents) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete academic year "${academicYear.year}" because student profiles are currently enrolled under this year.`
      });
    }

    // Dependency check 3: Teaching assignments in this year
    const hasAssignments = await TeachingAssignment.exists({ academicYear: academicYear.year, institution: institutionId });
    if (hasAssignments) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete academic year "${academicYear.year}" because teaching assignments are configured for it.`
      });
    }

    await AcademicYear.findByIdAndDelete(academicYear._id);

    await logAudit(institutionId, req.currentUser._id, 'DELETE_ACADEMIC_YEAR', academicYear._id, 'AcademicYear', {
      year: academicYear.year
    });

    return res.status(200).json({
      success: true,
      message: `Academic year "${academicYear.year}" was permanently deleted.`
    });
  } catch (error) {
    console.error('deleteAcademicYear error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete academic year.' });
  }
};

/**
 * @desc Permanently delete class with dependency checks
 */
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.currentUser.institution._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid class ID.' });
    }

    const classDoc = await Class.findOne({ _id: id, institution: institutionId });
    if (!classDoc) {
      return res.status(404).json({ success: false, error: 'Class not found.' });
    }

    // Check for enrolled students
    const studentCount = await StudentProfile.countDocuments({
      institution: institutionId,
      $or: [
        { classRef: classDoc._id },
        {
          department: classDoc.department,
          academicYear: classDoc.academicYear,
          semester: classDoc.semester,
          section: classDoc.section
        }
      ]
    });

    // Check for teaching assignments
    const assignmentCount = await TeachingAssignment.countDocuments({
      institution: institutionId,
      classRef: classDoc._id
    });

    const isConfirmed = req.query.confirm === 'true' || 
                        req.query.confirmed === 'true' || 
                        req.query.force === 'true' || 
                        req.body?.confirm === true || 
                        req.body?.confirmed === true;

    // If section has dependencies and admin hasn't confirmed, prompt for explicit confirmation
    if ((studentCount > 0 || assignmentCount > 0) && !isConfirmed) {
      return res.status(400).json({
        success: false,
        requiresConfirmation: true,
        error: `This section contains ${studentCount} enrolled student(s) and ${assignmentCount} assignment(s). Explicit confirmation is required to proceed with deletion.`,
        dependencies: {
          studentCount,
          assignmentCount
        }
      });
    }

    // Begin safe transactional deletion
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionErr) {
      session = null;
    }

    try {
      const opts = session ? { session } : {};

      // 1. Unassign enrolled students from this section (preserves user account, profile, marks, attendance)
      if (studentCount > 0) {
        await StudentProfile.updateMany(
          {
            institution: institutionId,
            $or: [
              { classRef: classDoc._id },
              {
                department: classDoc.department,
                academicYear: classDoc.academicYear,
                semester: classDoc.semester,
                section: classDoc.section
              }
            ]
          },
          {
            $unset: { classRef: 1, section: 1 }
          },
          opts
        );
      }

      // 2. Remove section-specific teaching assignments (preserves teachers and subjects intact)
      if (assignmentCount > 0) {
        await TeachingAssignment.deleteMany(
          {
            institution: institutionId,
            classRef: classDoc._id
          },
          opts
        );
      }

      // 3. Delete the Class document
      await Class.findByIdAndDelete(classDoc._id, opts);

      if (session) {
        await session.commitTransaction();
      }
    } catch (dbErr) {
      if (session) {
        await session.abortTransaction();
      }
      throw dbErr;
    } finally {
      if (session) {
        session.endSession();
      }
    }

    await logAudit(institutionId, req.currentUser._id, 'DELETE_CLASS', classDoc._id, 'Class', {
      name: classDoc.name,
      section: classDoc.section,
      department: classDoc.department,
      academicYear: classDoc.academicYear,
      semester: classDoc.semester,
      unassignedStudents: studentCount,
      removedAssignments: assignmentCount
    });

    await createNotification({
      institutionId,
      recipientId: req.currentUser._id,
      title: `Section Deleted: ${classDoc.section}`,
      message: `Section "${classDoc.section}" (${classDoc.department}) was permanently deleted.${studentCount > 0 ? ` ${studentCount} enrolled student(s) were unassigned and require attention.` : ''}`,
      category: 'departments_sections',
      severity: studentCount > 0 ? 'warning' : 'info',
      destinationUrl: '/admin/classes'
    });

    return res.status(200).json({
      success: true,
      message: `Section "${classDoc.section}" (${classDoc.department}) was permanently deleted.${studentCount > 0 ? ` ${studentCount} enrolled student(s) unassigned.` : ''}`,
      unassignedStudents: studentCount,
      removedAssignments: assignmentCount
    });
  } catch (error) {
    console.error('deleteClass error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete class.' });
  }
};

/**
 * @desc Permanently delete department with comprehensive dependency checks
 */
exports.deleteDepartment = async (req, res) => {
  try {
    const institutionId = req.currentUser.institution._id;
    const rawDeptName = req.params.departmentName;
    const yearOfStudy = req.query.yearOfStudy || req.body?.yearOfStudy;
    const course = req.query.course || req.body?.course;

    if (!rawDeptName || !rawDeptName.trim()) {
      return res.status(400).json({ success: false, error: 'Department name is required.' });
    }

    const deptName = decodeURIComponent(rawDeptName).trim();
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build matching variations (Name and Code if in config)
    const matchedConfig = DEPARTMENTS.find(d =>
      d.name.toLowerCase() === deptName.toLowerCase() ||
      d.code.toLowerCase() === deptName.toLowerCase()
    );

    const deptRegexConditions = [
      { department: new RegExp(`^${escapeRegex(deptName)}$`, 'i') }
    ];
    if (matchedConfig) {
      deptRegexConditions.push({ department: new RegExp(`^${escapeRegex(matchedConfig.name)}$`, 'i') });
      deptRegexConditions.push({ department: new RegExp(`^${escapeRegex(matchedConfig.code)}$`, 'i') });
    }
    const deptOrFilter = { $or: deptRegexConditions };

    // 1. Find classes associated with this department in this institution
    const classFilter = {
      institution: institutionId,
      ...deptOrFilter
    };
    if (yearOfStudy) {
      classFilter.yearOfStudy = yearOfStudy;
    }
    if (course) {
      classFilter.course = course;
    }

    const classes = await Class.find(classFilter);
    const classIds = classes.map(c => c._id);

    // 2. Check for enrolled students
    const studentFilter = {
      institution: institutionId,
      $or: [
        ...deptRegexConditions,
        { classRef: { $in: classIds } }
      ]
    };
    if (yearOfStudy) {
      studentFilter.yearOfStudy = yearOfStudy;
    }
    if (course) {
      studentFilter.course = course;
    }

    const studentCount = await StudentProfile.countDocuments(studentFilter);
    if (studentCount > 0) {
      await createNotification({
        institutionId,
        recipientId: req.currentUser._id,
        title: `Department Deletion Blocked: ${deptName}`,
        message: `Cannot delete department "${deptName}" because ${studentCount} enrolled student(s) are assigned to it.`,
        category: 'departments_sections',
        severity: 'warning',
        destinationUrl: '/admin/classes'
      });
      return res.status(400).json({
        success: false,
        error: `Cannot delete department "${deptName}" because ${studentCount} enrolled student${studentCount > 1 ? 's are' : ' is'} assigned to it. Please reassign or remove all students before deleting this department.`
      });
    }

    // 3. Check for teaching assignments
    const assignmentCount = await TeachingAssignment.countDocuments({
      institution: institutionId,
      classRef: { $in: classIds }
    });
    if (assignmentCount > 0) {
      await createNotification({
        institutionId,
        recipientId: req.currentUser._id,
        title: `Department Deletion Blocked: ${deptName}`,
        message: `Cannot delete department "${deptName}" because ${assignmentCount} active teaching assignment(s) are configured for its sections.`,
        category: 'departments_sections',
        severity: 'warning',
        destinationUrl: '/admin/classes'
      });
      return res.status(400).json({
        success: false,
        error: `Cannot delete department "${deptName}" because ${assignmentCount} active teaching assignment${assignmentCount > 1 ? 's are' : ' is'} configured for its sections. Please reassign or remove them first.`
      });
    }

    // 4. Check for faculty assigned to this department
    const teacherCount = await TeacherProfile.countDocuments({
      institution: institutionId,
      ...deptOrFilter
    });
    if (teacherCount > 0 && !yearOfStudy) {
      await createNotification({
        institutionId,
        recipientId: req.currentUser._id,
        title: `Department Deletion Blocked: ${deptName}`,
        message: `Cannot delete department "${deptName}" because ${teacherCount} faculty member(s) are assigned to it.`,
        category: 'departments_sections',
        severity: 'warning',
        destinationUrl: '/admin/classes'
      });
      return res.status(400).json({
        success: false,
        error: `Cannot delete department "${deptName}" because ${teacherCount} faculty member${teacherCount > 1 ? 's are' : ' is'} assigned to it. Please reassign faculty to another department first.`
      });
    }

    // 5. Check for subjects assigned to this department
    const subjectCount = await Subject.countDocuments({
      institution: institutionId,
      ...deptOrFilter
    });
    if (subjectCount > 0 && !yearOfStudy) {
      await createNotification({
        institutionId,
        recipientId: req.currentUser._id,
        title: `Department Deletion Blocked: ${deptName}`,
        message: `Cannot delete department "${deptName}" because ${subjectCount} subject(s) are configured for it.`,
        category: 'departments_sections',
        severity: 'warning',
        destinationUrl: '/admin/classes'
      });
      return res.status(400).json({
        success: false,
        error: `Cannot delete department "${deptName}" because ${subjectCount} subject${subjectCount > 1 ? 's are' : ' is'} configured for it. Please reassign or delete these subjects first.`
      });
    }

    // If safe, delete the matching empty classes/sections
    if (classIds.length > 0) {
      await Class.deleteMany({ _id: { $in: classIds } });
    }

    await logAudit(institutionId, req.currentUser._id, 'DELETE_DEPARTMENT', null, 'Department', {
      department: deptName,
      yearOfStudy: yearOfStudy || 'All',
      course: course || 'All',
      deletedSectionsCount: classIds.length
    });

    await createNotification({
      institutionId,
      recipientId: req.currentUser._id,
      title: `Department Deleted: ${deptName}`,
      message: `Department "${deptName}" and its empty sections were permanently deleted.`,
      category: 'departments_sections',
      severity: 'warning',
      destinationUrl: '/admin/classes'
    });

    return res.status(200).json({
      success: true,
      message: `Department "${deptName}" ${yearOfStudy ? `in ${yearOfStudy}` : ''} and its empty sections were permanently deleted.`
    });
  } catch (error) {
    console.error('deleteDepartment error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete department.' });
  }
};
