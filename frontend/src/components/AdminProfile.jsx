import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Hash, 
  Briefcase, 
  GraduationCap, 
  Building2, 
  ShieldCheck, 
  Edit3, 
  Save, 
  X, 
  Camera, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Lock,
  Upload,
  Clock
} from 'lucide-react';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import { 
  ADMIN_QUALIFICATION_OPTIONS, 
  STANDARD_ADMIN_QUALIFICATIONS 
} from '../config/qualifications';

// Helper to generate initials from full name or user ID
const getInitials = (name, fallbackId = 'AD') => {
  if (!name || typeof name !== 'string') return (fallbackId || 'AD').slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return (fallbackId || 'AD').slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Helper to parse and normalize qualifications from various backward-compatible formats
const parseQualifications = (p) => {
  let rawList = [];
  if (Array.isArray(p?.qualifications) && p.qualifications.length > 0) {
    rawList = p.qualifications;
  } else if (p?.highestQualification && typeof p.highestQualification === 'string') {
    if (p.highestQualification.includes(',')) {
      rawList = p.highestQualification.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      rawList = [p.highestQualification.trim()];
    }
  }

  const migrated = [];
  const custom = [];

  rawList.forEach(item => {
    if (!item || typeof item !== 'string') return;
    const trimmed = item.trim();
    if (!trimmed) return;

    if (trimmed === 'B.Tech / B.E.') {
      migrated.push('B.Tech', 'B.E.');
    } else if (trimmed === 'M.Tech / M.E.') {
      migrated.push('M.Tech', 'M.E.');
    } else if (STANDARD_ADMIN_QUALIFICATIONS.includes(trimmed)) {
      migrated.push(trimmed);
    } else if (trimmed === 'Other') {
      // Handled via hasOther
    } else {
      custom.push(trimmed);
    }
  });

  const uniqueSelected = Array.from(new Set(migrated));
  return {
    selectedQualifications: uniqueSelected,
    customQualificationText: custom.join(', '),
    hasOther: custom.length > 0 || rawList.includes('Other')
  };
};

// Helper to format qualifications for comma-separated display
const getDisplayQualifications = (p) => {
  if (!p) return 'Not specified';
  const { selectedQualifications, customQualificationText } = parseQualifications(p);
  const items = [...selectedQualifications];
  if (customQualificationText) {
    customQualificationText.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
      if (!items.includes(c)) items.push(c);
    });
  }
  if (items.length > 0) {
    return items.join(', ');
  }
  return p.highestQualification || 'Not specified';
};

export default function AdminProfile() {
  // Master Profile Data from Database
  const [profile, setProfile] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit Mode Toggle
  const [isEditing, setIsEditing] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    qualifications: [],
    customQualification: '',
    department: '',
    yearsOfExperience: '',
    profilePhoto: ''
  });

  // Track if "Other" custom qualification is active
  const [isOtherQualification, setIsOtherQualification] = useState(false);

  // Validation Errors
  const [formErrors, setFormErrors] = useState({});

  // Modals & Camera State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Refs for uploads and camera
  const fileInputRef = useRef(null);
  const mobileCameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Helper to resolve Department name from ID or code
  const getDepartmentName = (deptValue) => {
    if (!deptValue) return 'General Administration';
    const matched = departments.find(d =>
      (d._id && String(d._id) === String(deptValue)) ||
      (d.code && d.code.toLowerCase() === String(deptValue).toLowerCase()) ||
      (d.name && d.name.toLowerCase() === String(deptValue).toLowerCase())
    );
    return matched ? matched.name : deptValue;
  };

  // Fetch administrator profile & available departments
  const loadProfileData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, deptRes] = await Promise.all([
        adminApi.getAdminProfile(),
        adminApi.getDepartments().catch(() => ({ success: false, departments: [] }))
      ]);

      if (profileRes && profileRes.success && profileRes.profile) {
        const p = profileRes.profile;
        setProfile(p);
        populateFormData(p);
      } else {
        setError(profileRes?.error || 'Failed to load administrator profile');
      }

      // Merge departments from profile endpoint and departments endpoint
      const allDepts = [];
      if (profileRes?.departments && Array.isArray(profileRes.departments)) {
        profileRes.departments.forEach(d => {
          const name = typeof d === 'string' ? d : d.name;
          if (name && !allDepts.some(item => (typeof item === 'string' ? item : item.name) === name)) {
            allDepts.push(d);
          }
        });
      }
      if (deptRes?.departments && Array.isArray(deptRes.departments)) {
        deptRes.departments.forEach(d => {
          const name = typeof d === 'string' ? d : d.name;
          if (name && !allDepts.some(item => (typeof item === 'string' ? item : item.name) === name)) {
            allDepts.push(d);
          }
        });
      }
      setDepartments(allDepts);
    } catch (err) {
      console.error('Failed to load admin profile:', err);
      setError(err?.response?.data?.error || err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  usePageRefresh(loadProfileData);

  useEffect(() => {
    loadProfileData();
  }, []);

  // Populate form data from profile model
  const populateFormData = (p) => {
    const { selectedQualifications, customQualificationText, hasOther } = parseQualifications(p);

    setFormData({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      designation: p.designation || '',
      qualifications: selectedQualifications,
      customQualification: customQualificationText,
      department: p.department || '',
      yearsOfExperience: p.yearsOfExperience !== undefined && p.yearsOfExperience !== null ? String(p.yearsOfExperience) : '',
      profilePhoto: p.profilePhoto || ''
    });

    setIsOtherQualification(hasOther);
    setFormErrors({});
  };

  // Start Editing
  const handleStartEdit = () => {
    if (profile) {
      populateFormData(profile);
    }
    setIsEditing(true);
    setError('');
    setSuccessMessage('');
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    if (profile) {
      populateFormData(profile);
    }
    setIsEditing(false);
    setFormErrors({});
    setError('');
  };

  // Handle Input Changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // Handle Qualification Checkbox Toggle
  const handleToggleQualification = (opt) => {
    if (opt === 'Other') {
      setIsOtherQualification(prev => {
        const nextVal = !prev;
        if (!nextVal) {
          setFormData(f => ({ ...f, customQualification: '' }));
        }
        return nextVal;
      });
      if (formErrors.qualifications) {
        setFormErrors(prev => {
          const copy = { ...prev };
          delete copy.qualifications;
          return copy;
        });
      }
      return;
    }

    setFormData(prev => {
      const current = prev.qualifications || [];
      const updated = current.includes(opt)
        ? current.filter(item => item !== opt)
        : [...current, opt];
      return { ...prev, qualifications: updated };
    });

    if (formErrors.qualifications) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.qualifications;
        return copy;
      });
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError('');
  };

  // Close Upload Modal safely
  const handleCloseUploadModal = () => {
    stopCamera();
    setIsUploadModalOpen(false);
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError('');
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported by your browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      console.warn('Camera access failed:', err);
      setCameraError('Camera not accessible or permission was denied. Please choose an image file from your device.');
      setIsCameraActive(false);
    }
  };

  // Capture Photo from Camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const size = Math.min(width, height);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const startX = (width - size) / 2;
      const startY = (height - size) / 2;
      ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      stopCamera();
      setIsUploadModalOpen(false);

      setFormData(prev => ({ ...prev, profilePhoto: dataUrl }));
      setIsEditing(true);
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.profilePhoto;
        return copy;
      });
    } catch (err) {
      console.error('Capture photo error:', err);
      setCameraError('Failed to capture photo from camera.');
    }
  };

  // Handle Photo File Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type (PNG, JPG, JPEG, WebP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setFormErrors(prev => ({ ...prev, profilePhoto: 'Please upload a valid image file (PNG, JPG, JPEG, or WebP)' }));
      return;
    }

    // Validate size (max 2.5MB)
    if (file.size > 2.5 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, profilePhoto: 'Photo size must be less than 2.5 MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, profilePhoto: reader.result }));
      setIsEditing(true);
      handleCloseUploadModal();
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.profilePhoto;
        return copy;
      });
    };
    reader.onerror = () => {
      setFormErrors(prev => ({ ...prev, profilePhoto: 'Failed to read image file' }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Remove Photo
  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, profilePhoto: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm Removal of Profile Photo
  const confirmRemovePhoto = () => {
    handleRemovePhoto();
    setIsDeleteModalOpen(false);
    setIsEditing(true);
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Form Client-side Validation
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Full Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Full Name must be at least 2 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Official Email Address is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address';
    }

    if (formData.phone.trim()) {
      const cleanDigits = formData.phone.trim().replace(/\D/g, '');
      if (cleanDigits.length !== 10) {
        errors.phone = 'Contact number must be exactly 10 digits';
      }
    }

    const hasStandard = (formData.qualifications || []).length > 0;
    const hasCustom = isOtherQualification && Boolean(formData.customQualification?.trim());
    if (isOtherQualification && !formData.customQualification?.trim()) {
      errors.qualifications = 'Please specify your other qualification';
    } else if (!hasStandard && !hasCustom) {
      errors.qualifications = 'Please select at least one educational qualification';
    }

    if (formData.yearsOfExperience !== '' && formData.yearsOfExperience !== undefined) {
      const num = Number(formData.yearsOfExperience);
      if (isNaN(num) || num < 0 || num > 70) {
        errors.yearsOfExperience = 'Please enter a valid non-negative number of years (0 - 70)';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Changes Submission
  const handleSaveChanges = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const finalQualifications = [...(formData.qualifications || []).filter(q => q !== 'Other')];
      if (isOtherQualification && formData.customQualification?.trim()) {
        const customItems = formData.customQualification.split(',').map(s => s.trim()).filter(Boolean);
        customItems.forEach(item => {
          if (!finalQualifications.includes(item)) {
            finalQualifications.push(item);
          }
        });
      }

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        designation: formData.designation.trim(),
        highestQualification: finalQualifications.join(', '),
        qualifications: finalQualifications,
        department: formData.department.trim(),
        yearsOfExperience: formData.yearsOfExperience !== '' ? Number(formData.yearsOfExperience) : 0,
        profilePhoto: formData.profilePhoto
      };

      const res = await adminApi.updateAdminProfile(payload);

      if (res && res.success && res.profile) {
        setProfile(res.profile);
        populateFormData(res.profile);
        setIsEditing(false);
        setSuccessMessage('Administrator profile updated successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setError(res?.error || 'Failed to update administrator profile');
        if (res?.errors) {
          setFormErrors(res.errors);
        }
      }
    } catch (err) {
      console.error('Update administrator profile error:', err);
      const serverMsg = err?.response?.data?.error || err.message || 'Server error while saving profile';
      setError(serverMsg);
      if (err?.response?.data?.errors) {
        setFormErrors(err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-medium">Loading administrator profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Profile Not Found</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
          Unable to retrieve your authenticated administrator profile from the database.
        </p>
        <button
          onClick={loadProfileData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentPhoto = isEditing ? formData.profilePhoto : (profile?.profilePhoto || formData.profilePhoto);
  const hasPhoto = Boolean(currentPhoto);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 transition-colors duration-200">
      
      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3 font-medium shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between gap-3 font-medium shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Profile Overview Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 text-center sm:text-left min-w-0">
            {/* Avatar & Photo Upload Controls */}
            <div className="relative shrink-0">
              {currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt={(isEditing ? formData.name : profile.name) || 'Administrator'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-xs border-2 border-indigo-200 dark:border-indigo-800 bg-slate-100 dark:bg-slate-800"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-xs border-2 border-indigo-200/50 dark:border-indigo-800/50">
                  {getInitials(isEditing ? (formData.name || profile.name) : profile.name, profile.userId)}
                </div>
              )}

              {/* Upload Image & Delete Image Controls */}
              <div className="absolute -bottom-2 -right-2 flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setCameraError('');
                    setIsUploadModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                  title="Upload Image"
                  aria-label="Upload Image"
                >
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {hasPhoto && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Image"
                    aria-label="Delete Image"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Profile Header Details: Name, Designation, Department, Badges */}
            <div className="space-y-1 min-w-0">
              <h1 
                className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-xs sm:max-w-md lg:max-w-lg"
                title={(isEditing ? formData.name : profile.name) || 'Administrator'}
              >
                {(isEditing ? formData.name : profile.name) || 'Administrator'}
              </h1>

              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {(isEditing ? formData.designation : profile.designation) || 'Administrator'}
                {(isEditing ? formData.department : profile.department) 
                  ? ` • ${getDepartmentName(isEditing ? formData.department : profile.department)}` 
                  : ''}
              </p>

              {/* Status, Role, and ID Badges */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Administrator</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{profile.isActive ? 'Active' : 'Inactive'}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>ID: {profile.userId}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Edit / Cancel / Save */}
          <div className="flex items-center justify-center sm:justify-end gap-2.5 shrink-0 w-full md:w-auto">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {formErrors.profilePhoto && (
          <p className="text-xs text-rose-500 mt-3 font-medium text-center sm:text-left">{formErrors.profilePhoto}</p>
        )}
      </div>

      {/* Upload Image Modal */}
      {isUploadModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseUploadModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-photo-title"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="upload-photo-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Upload Profile Image
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose an image file or take a photo with your camera
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseUploadModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message if any */}
            {(cameraError || formErrors.profilePhoto) && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError || formErrors.profilePhoto}</span>
              </div>
            )}

            {isCameraActive ? (
              /* Live Camera Capture Interface */
              <div className="space-y-4 text-center">
                <div className="relative mx-auto w-60 h-60 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-md bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover [transform:scaleX(-1)]"
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Camera
                  </button>
                </div>
              </div>
            ) : (
              /* File Choose and Camera Trigger Options */
              <div className="space-y-3.5">
                {/* 1. File Upload Dropzone / Picker */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all group"
                >
                  <Upload className="w-8 h-8 text-indigo-500 dark:text-indigo-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Choose Image from Device
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports PNG, JPG, JPEG, WebP (Max 2.5 MB)
                  </p>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                </div>

                {/* 2. Device Camera Option */}
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-sm font-semibold text-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Take Photo with Camera</span>
                </button>

                {/* Mobile Camera Direct Button (for phones/tablets) */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => mobileCameraInputRef.current?.click()}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>Use device camera app directly</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hidden Input Elements */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <input
              ref={mobileCameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDeleteModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-photo-title"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-photo-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Remove Profile Photo?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your profile avatar will revert to your default initials.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to remove your current profile photo? This will not delete your account or any other administrator details.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemovePhoto}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Remove Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Content Grid: Two Balanced Columns (Personal Info & Professional Info) */}
      <form onSubmit={handleSaveChanges} className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">

        {/* 2. Personal Information Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 mb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Personal Information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Primary contact and personal details</p>
            </div>
          </div>

          <div className="space-y-4.5 sm:space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name {isEditing && <span className="text-rose-500">*</span>}
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter full name"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                      formErrors.name 
                        ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20' 
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">{formErrors.name}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.name || 'Not provided'}</span>
                </div>
              )}
            </div>

            {/* Admin ID (Read-only System Identifier) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Admin ID
                </label>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Read-only
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.userId}</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Unique ID</span>
              </div>
            </div>

            {/* Official Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Official Email Address {isEditing && <span className="text-rose-500">*</span>}
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="admin@classpulse.edu"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                      formErrors.email 
                        ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20' 
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">{formErrors.email}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{profile.email || 'Not provided'}</span>
                </div>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Contact Number
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                      formErrors.phone 
                        ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20' 
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">{formErrors.phone}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.phone ? profile.phone : 'Not provided'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Professional Information Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 mb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Professional Information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Academic credentials and administrative role</p>
            </div>
          </div>

          <div className="space-y-4.5 sm:space-y-5">
            {/* Designation */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Designation
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => handleInputChange('designation', e.target.value)}
                    placeholder="e.g. Principal, Director, System Administrator"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.designation || 'Administrator'}</span>
                </div>
              )}
            </div>

            {/* Highest Educational Qualification (Multiple Selection) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Highest Educational Qualification {isEditing && <span className="text-rose-500">*</span>}
              </label>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {ADMIN_QUALIFICATION_OPTIONS.map((opt) => {
                      const isSelected = opt === 'Other'
                        ? isOtherQualification
                        : (formData.qualifications || []).includes(opt);

                      return (
                        <label
                          key={opt}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-500 text-indigo-900 dark:text-indigo-100 shadow-2xs font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleQualification(opt)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer accent-indigo-600 shrink-0"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Custom Qualification input when "Other" is chosen */}
                  {isOtherQualification && (
                    <div className="space-y-1 pt-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Specify Other Qualification <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.customQualification}
                        onChange={(e) => handleInputChange('customQualification', e.target.value)}
                        placeholder="e.g. Post-Doctorate, M.Phil., PG Diploma"
                        className={`w-full px-3.5 py-2 rounded-xl border text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                          formErrors.qualifications
                            ? 'border-rose-400 dark:border-rose-500'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                    </div>
                  )}

                  {formErrors.qualifications && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">{formErrors.qualifications}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="break-words">
                    {getDisplayQualifications(profile)}
                  </span>
                </div>
              )}
            </div>

            {/* Department (dynamically loaded from DB) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Department
              </label>
              {isEditing ? (
                <div>
                  <select
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="">Select Department...</option>
                    {departments.length === 0 ? (
                      <option value="" disabled>No departments available</option>
                    ) : (
                      departments.map((dept) => {
                        const dVal = typeof dept === 'string' ? dept : (dept.name || dept._id);
                        const dKey = typeof dept === 'string' ? dept : (dept._id || dept.name);
                        const dLabel = typeof dept === 'string' ? dept : (dept.name || dept.code || 'Unnamed Department');
                        return (
                          <option key={dKey} value={dVal}>
                            {dLabel}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{getDepartmentName(profile.department)}</span>
                </div>
              )}
            </div>

            {/* Experience (Years) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Experience (Years)
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="number"
                    min="0"
                    max="70"
                    step="any"
                    value={formData.yearsOfExperience}
                    onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
                    placeholder="e.g. 8 or 4.5"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                      formErrors.yearsOfExperience 
                        ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20' 
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {formErrors.yearsOfExperience && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">{formErrors.yearsOfExperience}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.yearsOfExperience !== undefined && profile.yearsOfExperience !== null ? `${profile.yearsOfExperience} Years` : '0 Years'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </form>

    </div>
  );
}
