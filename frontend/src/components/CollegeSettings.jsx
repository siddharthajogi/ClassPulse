import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import { Loader2, Save, Building, AlertCircle, CheckCircle2, Upload, Trash2 } from 'lucide-react';

export default function CollegeSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    logoUrl: '',
    name: '',
    code: '',
    description: '',
    email: '',
    phone: ''
  });

  // Local image file selection and preview states (URL input has been completely removed)
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const [isCleared, setIsCleared] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSettings = useCallback(async () => {
    try {
      const instRes = await adminApi.getInstitutionSetupStatus();
      if (instRes.success && instRes.institution) {
        const inst = instRes.institution;
        setFormData({
          logoUrl: inst.logoUrl || '',
          name: inst.name || '',
          code: inst.code || '',
          description: inst.description || '',
          email: inst.email || '',
          phone: inst.phone || '',
          // Retain any other existing fields to avoid losing metadata
          type: inst.type || '',
          website: inst.website || '',
          address: inst.address || '',
          city: inst.city || '',
          state: inst.state || '',
          country: inst.country || '',
          timezone: inst.timezone || 'UTC'
        });
      }
    } catch (err) {
      setError('Failed to load college settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Clean up object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setError('');
    setSuccess('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType && !hasValidExt) {
      setError('Invalid file format. Please select a PNG, JPG, JPEG, or WebP image file.');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      setError('Selected image exceeds the 5 MB file size limit.');
      return;
    }

    // Clean up any previous local preview object URL
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    // Display immediate local preview
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    setSelectedFile(file);
    setIsCleared(false);
    setImageLoadError(false);
    setError('');
    setSuccess('');
  };

  const handleClearImage = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setSelectedFile(null);
    setIsCleared(true);
    setImageLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('');
    setSuccess('');
  };

  const validate = () => {
    const newErrors = {};

    // 1. Institution Name Validation
    const name = (formData.name || '').trim();
    if (!name) {
      newErrors.name = 'Institution Name is required.';
    }

    // 3. Code Validation
    const code = (formData.code || '').trim();
    if (!code) {
      newErrors.code = 'Institution Code is required.';
    }

    // 4. Description Validation
    const description = (formData.description || '').trim();
    if (!description) {
      newErrors.description = 'Description is required.';
    }

    // 5. Email Address Validation
    const email = (formData.email || '').trim();
    if (!email) {
      newErrors.email = 'Email Address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Please enter a valid email address (e.g. contact@institution.edu).';
      }
    }

    // 6. Phone Number Validation
    const phone = (formData.phone || '').trim();
    if (!phone) {
      newErrors.phone = 'Phone Number is required.';
    } else {
      const digitsOnly = phone.replace(/\D/g, '');
      const validChars = /^\+?[0-9\s\-()]{10,20}$/.test(phone);
      if (digitsOnly.length < 10 || digitsOnly.length > 15 || !validChars) {
        newErrors.phone = 'Please enter a valid phone number (10-15 digits, optional country code).';
      }
    }

    return newErrors;
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setSuccess('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setError('Please correct the highlighted validation errors before saving.');
      return;
    }

    try {
      setSaving(true);
      let logoUrlToSave = formData.logoUrl;

      // 1. If user clicked clear image, remove logo reference
      if (isCleared) {
        logoUrlToSave = '';
      } 
      // 2. If user selected a new file from computer, upload it now to get permanent URL
      else if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('logo', selectedFile);

        const uploadRes = await adminApi.uploadInstitutionLogo(uploadData);
        if (!uploadRes || !uploadRes.success || !uploadRes.url) {
          throw new Error(uploadRes?.error || 'Failed to upload college logo to server.');
        }
        logoUrlToSave = uploadRes.url;
      }

      const payload = {
        ...formData,
        logoUrl: logoUrlToSave,
        name: formData.name.trim(),
        code: formData.code.trim(),
        description: formData.description.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim()
      };

      const res = await adminApi.updateInstitutionSettings(payload);
      if (res.success && res.institution) {
        setSuccess('Institution profile updated successfully!');
        setFormData(prev => ({
          ...prev,
          ...res.institution,
          logoUrl: logoUrlToSave
        }));
        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
          setLocalPreviewUrl(null);
        }
        setSelectedFile(null);
        setIsCleared(false);
        setImageLoadError(false);
        setErrors({});
      } else {
        setError(res.error || 'Failed to save settings.');
      }
    } catch (err) {
      const backendError = err.response?.data?.error || err.message || 'Failed to save settings.';
      setError(backendError);
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <span className="text-sm font-medium">Loading institution profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 transition-colors duration-200">
      {/* Top Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          College Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your official institutional profile, identification codes, and primary contacts.
        </p>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Institution Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Institution Profile</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Institutional configuration and branding settings</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            * Required fields
          </span>
        </div>

        <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. College Logo (Choose Image and Preview Only - URL Input Completely Removed) */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  College Logo
                </label>
                {(isCleared ? false : (localPreviewUrl || formData.logoUrl)) && (
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Image</span>
                  </button>
                )}
              </div>

              {/* Action Area: Choose Image Button & File Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>{(isCleared ? false : (localPreviewUrl || formData.logoUrl)) ? 'Change Image' : 'Choose Image'}</span>
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select an image from your computer. Supported formats: PNG, JPG, JPEG, WebP, SVG (maximum 5MB).
                </p>
              </div>

              {/* Image Preview Area */}
              {(isCleared ? false : (localPreviewUrl || formData.logoUrl)) ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 transition-all">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail Box */}
                    <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                      {!imageLoadError ? (
                        <img
                          src={localPreviewUrl || formData.logoUrl}
                          alt="College Logo Preview"
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                          onError={() => setImageLoadError(true)}
                        />
                      ) : (
                        <Building className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>

                    {/* Metadata & Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Logo Preview
                        </span>
                        {selectedFile ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            Ready to Save
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            ✓ Active & Saved
                          </span>
                        )}
                      </div>

                      {imageLoadError ? (
                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                          Unable to load this image file. Please choose a different PNG, JPG, or WebP image.
                        </p>
                      ) : selectedFile ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <strong className="text-slate-700 dark:text-slate-300">{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(0)} KB) selected. Click "Save Changes" to save and apply this logo.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          This logo is currently saved and displayed in the Admin Dashboard college information card.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Clean Empty State without Broken Image Icon */
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Building className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isCleared ? 'Logo will be removed when saved' : 'No college logo configured'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isCleared
                        ? 'Click "Save Changes" to remove the logo from your college profile.'
                        : 'Click "Choose Image" above to upload a college logo from your computer.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Institution Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Institution Name <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. ClassPulse Institute of Technology"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 ${
                  errors.name
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {errors.name && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            {/* 3. Code */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Code <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="e.g. SPIT-01"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 ${
                  errors.code
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {errors.code && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.code}</span>
                </p>
              )}
            </div>

            {/* 4. Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Description <span className="text-rose-500 font-bold">*</span>
              </label>
              <textarea
                name="description"
                rows="4"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a comprehensive institutional description..."
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 ${
                  errors.description
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {errors.description && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.description}</span>
                </p>
              )}
            </div>

            {/* 5. Email Address */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. contact@institution.edu"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 ${
                  errors.email
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {errors.email && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* 6. Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. +91 9876543210 or (555) 123-4567"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 ${
                  errors.phone
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {errors.phone && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.phone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <span className="text-xs text-slate-400 dark:text-slate-400">
              Values are validated on submission and stored securely in MongoDB.
            </span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
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
          </div>
        </form>
      </div>
    </div>
  );
}
