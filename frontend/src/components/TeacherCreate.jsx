import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import QualificationMultiSelect from './QualificationMultiSelect';

export default function TeacherCreate() {
  const initialFormState = {
    teacherId: '',
    password: '',
    confirmPassword: '',
    department: '',
    designation: '',
    isActive: true,
    personalInfo: { name: '', email: '', phone: '', address: '' },
    professionalInfo: { qualifications: [], highestQualification: '', specialization: '', yearsOfExperience: '' }
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [designationSelect, setDesignationSelect] = useState('');
  const [specializationSelect, setSpecializationSelect] = useState('');

  const designationsList = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Lab Assistant'];
  const specializationsList = ['Computer Science', 'Data Science', 'Artificial Intelligence', 'Cyber Security', 'Electronics & Communication', 'Mechanical', 'Civil'];

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError('');
    try {
      const deptRes = await adminApi.getDepartments();
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDeptError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validate = () => {
    const newErrors = {};

    const cleanName = formData.personalInfo.name ? formData.personalInfo.name.trim() : '';
    if (!cleanName) {
      newErrors['personalInfo.name'] = 'Full Name is required';
    }

    const cleanTeacherId = formData.teacherId ? formData.teacherId.trim() : '';
    if (!cleanTeacherId) {
      newErrors.teacherId = 'Teacher/Faculty ID is required';
    }

    const cleanEmail = formData.personalInfo.email ? formData.personalInfo.email.trim() : '';
    if (!cleanEmail) {
      newErrors['personalInfo.email'] = 'Email Address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      newErrors['personalInfo.email'] = 'Please enter a valid email address';
    }

    const cleanPhone = formData.personalInfo.phone ? formData.personalInfo.phone.trim() : '';
    if (!cleanPhone) {
      newErrors['personalInfo.phone'] = 'Phone Number is required';
    } else if (!/^(?:\+?91[\-\s]?)?[6-9]\d{9}$|^[0-9]{10}$/.test(cleanPhone)) {
      newErrors['personalInfo.phone'] = 'Please enter a valid 10-digit phone number';
    }

    const cleanAddress = formData.personalInfo.address ? formData.personalInfo.address.trim() : '';
    if (!cleanAddress) {
      newErrors['personalInfo.address'] = 'Address is required';
    }

    if (!departmentSelect || departmentSelect === 'Select Department') {
      newErrors.department = 'Department is required';
    } else if (departmentSelect === 'Other' && (!formData.department || !formData.department.trim())) {
      newErrors.department = 'Please specify custom department';
    }

    if (!designationSelect || designationSelect === 'Select Designation') {
      newErrors.designation = 'Designation is required';
    } else if (designationSelect === 'Other' && (!formData.designation || !formData.designation.trim())) {
      newErrors.designation = 'Please specify custom designation';
    }

    if (!formData.professionalInfo.qualifications || formData.professionalInfo.qualifications.length === 0) {
      newErrors['professionalInfo.qualifications'] = 'Please select at least one qualification';
    }

    if (!specializationSelect || specializationSelect === 'Select Specialization') {
      newErrors['professionalInfo.specialization'] = 'Specialization is required';
    } else if (specializationSelect === 'Other' && (!formData.professionalInfo.specialization || !formData.professionalInfo.specialization.trim())) {
      newErrors['professionalInfo.specialization'] = 'Please specify custom specialization';
    }

    const expStr = String(formData.professionalInfo.yearsOfExperience ?? '').trim();
    if (expStr === '') {
      newErrors['professionalInfo.yearsOfExperience'] = 'Years of Experience is required';
    } else {
      const expNum = Number(expStr);
      if (isNaN(expNum) || expNum < 0 || expNum > 60) {
        newErrors['professionalInfo.yearsOfExperience'] = 'Experience must be a number between 0 and 60';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Initial Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[a-zA-Z]/.test(formData.password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password)) {
      newErrors.password = 'Password must include letters and numbers or symbols';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    return newErrors;
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setDepartmentSelect('');
    setDesignationSelect('');
    setSpecializationSelect('');
    setErrors({});
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setError('Please fill in all mandatory fields correctly.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        teacherId: formData.teacherId.trim(),
        password: formData.password,
        department: formData.department.trim(),
        designation: formData.designation.trim(),
        isActive: formData.isActive,
        personalInfo: {
          name: formData.personalInfo.name.trim(),
          email: formData.personalInfo.email.trim().toLowerCase(),
          phone: formData.personalInfo.phone.trim(),
          address: formData.personalInfo.address.trim()
        },
        professionalInfo: {
          qualifications: formData.professionalInfo.qualifications,
          highestQualification: formData.professionalInfo.qualifications.join(', '),
          specialization: formData.professionalInfo.specialization.trim(),
          yearsOfExperience: Number(formData.professionalInfo.yearsOfExperience)
        }
      };

      const res = await adminApi.createTeacher(payload);
      if (res.success) {
        setSuccess(`Teacher account created successfully with ID: ${res.teacherId}`);
        resetForm();
      }
    } catch (err) {
      const backendError = err.response?.data?.error || 'Failed to create teacher';
      setError(backendError);
      if (err.response?.data?.errors) {
        const bErrors = err.response.data.errors;
        const mappedErrors = { ...bErrors };
        if (bErrors.name) mappedErrors['personalInfo.name'] = bErrors.name;
        if (bErrors.email) mappedErrors['personalInfo.email'] = bErrors.email;
        if (bErrors.phone) mappedErrors['personalInfo.phone'] = bErrors.phone;
        if (bErrors.address) mappedErrors['personalInfo.address'] = bErrors.address;
        if (bErrors.qualifications) mappedErrors['professionalInfo.qualifications'] = bErrors.qualifications;
        if (bErrors.highestQualification) mappedErrors['professionalInfo.qualifications'] = bErrors.highestQualification;
        if (bErrors.specialization) mappedErrors['professionalInfo.specialization'] = bErrors.specialization;
        if (bErrors.yearsOfExperience) mappedErrors['professionalInfo.yearsOfExperience'] = bErrors.yearsOfExperience;
        setErrors(mappedErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 transition-colors duration-200">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Create Teacher Account</h1>
      
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-300 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate autoComplete="off">
        {/* Decoy fields to prevent aggressive browser autofill */}
        <input type="email" name="fake_email" className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="off" />
        <input type="password" name="fake_password" className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="new-password" />

        {/* SECTION A: Personal Information */}
        <section>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="personalInfo.name"
                value={formData.personalInfo.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors['personalInfo.name'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. Dr. Alan Turing"
              />
              {errors['personalInfo.name'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['personalInfo.name']}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teacher/Faculty ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="teacherId"
                value={formData.teacherId}
                onChange={handleChange}
                autoComplete="off"
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.teacherId ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. TCH101"
              />
              {errors.teacherId && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.teacherId}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="personalInfo.email"
                value={formData.personalInfo.email}
                onChange={handleChange}
                autoComplete="off"
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors['personalInfo.email'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. alan.turing@classpulse.edu"
              />
              {errors['personalInfo.email'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['personalInfo.email']}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="personalInfo.phone"
                value={formData.personalInfo.phone}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors['personalInfo.phone'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. 9876543210"
              />
              {errors['personalInfo.phone'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['personalInfo.phone']}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="personalInfo.address"
                value={formData.personalInfo.address}
                onChange={handleChange}
                rows={2}
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors['personalInfo.address'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="Enter full residential or campus address"
              />
              {errors['personalInfo.address'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['personalInfo.address']}</p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION B: Professional Information */}
        <section>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Professional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Department <span className="text-rose-500">*</span>
                </label>
                {loadingDepts && (
                  <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Loading...</span>
                  </span>
                )}
                {deptError && (
                  <button
                    type="button"
                    onClick={fetchDepartments}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
              <select
                name="department"
                value={departmentSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setDepartmentSelect(val);
                  if (errors.department) setErrors(prev => { const u = {...prev}; delete u.department; return u; });
                  if (val !== 'Other') setFormData(prev => ({ ...prev, department: val }));
                  else setFormData(prev => ({ ...prev, department: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                  errors.department ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <option value="">Select Department</option>
                {loadingDepts ? (
                  <option value="" disabled>Loading departments...</option>
                ) : deptError ? (
                  <option value="" disabled>Error loading departments</option>
                ) : departments.length === 0 ? (
                  <option value="" disabled>No departments available. Create a department first.</option>
                ) : (
                  departments
                    .filter(d => d && (d.name || d._id))
                    .map(d => (
                      <option key={d._id || d.name} value={d._id || d.name}>
                        {d.name || d.code || 'Unnamed Department'}
                      </option>
                    ))
                )}
                <option value="Other">Other</option>
              </select>
              {departmentSelect === 'Other' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                      errors.department ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Enter custom department"
                  />
                </div>
              )}
              {errors.department && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.department}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Designation <span className="text-rose-500">*</span>
              </label>
              <select
                value={designationSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setDesignationSelect(val);
                  if (errors.designation) setErrors(prev => { const u = {...prev}; delete u.designation; return u; });
                  if (val !== 'Other') setFormData(prev => ({ ...prev, designation: val }));
                  else setFormData(prev => ({ ...prev, designation: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                  errors.designation ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <option value="">Select Designation</option>
                {designationsList.map(d => <option key={d} value={d}>{d}</option>)}
                <option value="Other">Other</option>
              </select>
              {designationSelect === 'Other' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                      errors.designation ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Enter custom designation"
                  />
                </div>
              )}
              {errors.designation && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.designation}</p>
              )}
            </div>

            <div>
              <QualificationMultiSelect
                id="teacher-create-qualifications"
                selected={formData.professionalInfo.qualifications}
                onChange={(newQualifications) => {
                  if (errors['professionalInfo.qualifications'] || errors['professionalInfo.highestQualification']) {
                    setErrors((prev) => {
                      const u = { ...prev };
                      delete u['professionalInfo.qualifications'];
                      delete u['professionalInfo.highestQualification'];
                      return u;
                    });
                  }
                  setFormData((prev) => ({
                    ...prev,
                    professionalInfo: {
                      ...prev.professionalInfo,
                      qualifications: newQualifications,
                      highestQualification: newQualifications.join(', ')
                    }
                  }));
                }}
                error={errors['professionalInfo.qualifications'] || errors['professionalInfo.highestQualification']}
                required={true}
                label="Qualifications"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Specialization <span className="text-rose-500">*</span>
              </label>
              <select
                value={specializationSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setSpecializationSelect(val);
                  if (errors['professionalInfo.specialization']) {
                    setErrors(prev => { const u = {...prev}; delete u['professionalInfo.specialization']; return u; });
                  }
                  if (val !== 'Other') setFormData(prev => ({ ...prev, professionalInfo: { ...prev.professionalInfo, specialization: val } }));
                  else setFormData(prev => ({ ...prev, professionalInfo: { ...prev.professionalInfo, specialization: '' } }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                  errors['professionalInfo.specialization'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <option value="">Select Specialization</option>
                {specializationsList.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Other">Other</option>
              </select>
              {specializationSelect === 'Other' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                  <input
                    type="text"
                    name="professionalInfo.specialization"
                    value={formData.professionalInfo.specialization}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                      errors['professionalInfo.specialization'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Enter custom specialization"
                  />
                </div>
              )}
              {errors['professionalInfo.specialization'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['professionalInfo.specialization']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Years of Experience <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="professionalInfo.yearsOfExperience"
                value={formData.professionalInfo.yearsOfExperience}
                onChange={handleChange}
                min="0"
                max="60"
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors['professionalInfo.yearsOfExperience'] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. 5"
              />
              {errors['professionalInfo.yearsOfExperience'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['professionalInfo.yearsOfExperience']}</p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION C: Login Credentials */}
        <section>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Login Credentials</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Login ID</label>
              <input
                type="text"
                value={formData.teacherId || 'Will use Teacher/Faculty ID'}
                disabled
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"
              />
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 pr-10 ${
                      errors.password ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Min 8 chars, letter + number/symbol"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.password}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 pr-10 ${
                      errors.confirmPassword ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Re-enter initial password"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION D: Status */}
        <section>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Status</h3>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Account Status:</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive !== false}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{formData.isActive !== false ? 'Active' : 'Inactive'}</span>
            </label>
          </div>
        </section>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2 cursor-pointer disabled:opacity-70 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Teacher Account
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
          >
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}
