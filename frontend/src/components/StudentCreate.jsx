import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { Loader2, AlertCircle, CheckCircle2, Building2, Layers, ExternalLink } from 'lucide-react';

export default function StudentCreate() {
  const initialFormState = {
    studentId: '',
    password: '',
    confirmPassword: '',
    course: '',
    department: '',
    academicYear: '',
    semester: '',
    section: '',
    personalInfo: {
      name: '',
      email: ''
    }
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [configuredClasses, setConfiguredClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [courseSelect, setCourseSelect] = useState('');
  const [semesterSelect, setSemesterSelect] = useState('');

  const coursesList = ['B.Tech', 'M.Tech', 'Ph.D.', 'B.Sc.', 'M.Sc.', 'BCA', 'MCA'];
  const semestersList = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError('');
    try {
      const res = await adminApi.getDepartments();
      if (res && res.success) {
        setDepartments(res.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments in StudentCreate:', err);
      setDeptError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      fetchDepartments();
      try {
        const [clsRes, ayRes] = await Promise.all([
          adminApi.getClasses(),
          adminApi.getAcademicYears()
        ]);
        if (clsRes && clsRes.success) setConfiguredClasses(clsRes.classes || []);
        if (ayRes && ayRes.success) {
          setAcademicYears(ayRes.academicYears || []);
          const activeYear = (ayRes.academicYears || []).find(y => y.isActive);
          if (activeYear && !formData.academicYear) {
            setFormData(prev => ({ ...prev, academicYear: activeYear.year }));
          }
        }
      } catch (err) {
        console.error('Failed to load classes and academic years in StudentCreate:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Derive matching configured sections for currently selected academic parameters
  const matchingSections = configuredClasses.filter(c => {
    if (!formData.course || !formData.department || !formData.semester) return false;
    const courseMatch = (c.course || '').toLowerCase() === formData.course.toLowerCase();
    const semMatch = String(c.semester || '').replace(/[^0-9]/g, '') === String(formData.semester || '').replace(/[^0-9]/g, '');

    const selectedDeptObj = departments.find(d => d._id === formData.department || d.name === formData.department || d.code === formData.department);
    const selectedDeptName = selectedDeptObj ? selectedDeptObj.name.toLowerCase() : formData.department.toLowerCase();
    const selectedDeptCode = selectedDeptObj && selectedDeptObj.code ? selectedDeptObj.code.toLowerCase() : '';
    const selectedDeptId = selectedDeptObj ? String(selectedDeptObj._id) : '';

    const classDept = (c.department || '').toLowerCase();
    const classDeptRef = c.departmentRef ? String(c.departmentRef) : '';

    const deptMatch =
      classDept === selectedDeptName ||
      (selectedDeptCode && classDept === selectedDeptCode) ||
      (selectedDeptId && classDeptRef === selectedDeptId) ||
      departments.some(d =>
        (d._id === selectedDeptId || d.name.toLowerCase() === selectedDeptName || (selectedDeptCode && d.code.toLowerCase() === selectedDeptCode)) &&
        (classDept === d.name.toLowerCase() || (d.code && classDept === d.code.toLowerCase()))
      );

    return courseMatch && semMatch && deptMatch;
  });

  const derivedYearOfStudy = (() => {
    if (!formData.semester) return '';
    const match = String(formData.semester).match(/\d+/);
    if (!match) return '';
    const num = parseInt(match[0], 10);
    if (num === 1 || num === 2) return 'First Year';
    if (num === 3 || num === 4) return 'Second Year';
    if (num === 5 || num === 6) return 'Third Year';
    if (num === 7 || num === 8) return 'Fourth Year';
    return '';
  })();

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

    const cleanEmail = formData.personalInfo.email ? formData.personalInfo.email.trim() : '';
    if (!cleanEmail) {
      newErrors['personalInfo.email'] = 'Email Address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      newErrors['personalInfo.email'] = 'Please enter a valid email address';
    }

    if (!courseSelect || courseSelect === 'Select Course') {
      newErrors.course = 'Course is required';
    } else if (courseSelect === 'Other' && (!formData.course || !formData.course.trim())) {
      newErrors.course = 'Please specify custom course';
    }

    if (!departmentSelect || departmentSelect === 'Select Department') {
      newErrors.department = 'Department is required';
    } else if (departmentSelect === 'Other' && (!formData.department || !formData.department.trim())) {
      newErrors.department = 'Please specify custom department';
    }

    if (!semesterSelect || semesterSelect === 'Select Semester') {
      newErrors.semester = 'Semester is required';
    } else if (semesterSelect === 'Other' && (!formData.semester || !formData.semester.trim())) {
      newErrors.semester = 'Please specify custom semester';
    }

    if (!formData.academicYear || !formData.academicYear.trim()) {
      newErrors.academicYear = 'Academic Year is required';
    }

    if (!formData.section || !formData.section.trim()) {
      newErrors.section = 'Section is required';
    }

    if (!formData.studentId || !formData.studentId.trim()) {
      newErrors.studentId = 'Student Login ID is required';
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

  const handleClear = () => {
    setFormData(initialFormState);
    setDepartmentSelect('');
    setCourseSelect('');
    setSemesterSelect('');
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
        studentId: formData.studentId.trim(),
        password: formData.password,
        course: formData.course.trim(),
        department: formData.department.trim(),
        academicYear: formData.academicYear.trim(),
        semester: formData.semester.trim(),
        section: formData.section.trim(),
        personalInfo: {
          name: formData.personalInfo.name.trim(),
          email: formData.personalInfo.email.trim().toLowerCase()
        }
      };

      const res = await adminApi.createStudent(payload);
      if (res.success) {
        setSuccess(`Student account created successfully with ID: ${res.studentId}`);
        handleClear();
      }
    } catch (err) {
      const backendError = err.response?.data?.error || 'Failed to create student';
      setError(backendError);
      if (err.response?.data?.errors) {
        // Map backend field errors to frontend form paths
        const bErrors = err.response.data.errors;
        const mappedErrors = { ...bErrors };
        if (bErrors.name) mappedErrors['personalInfo.name'] = bErrors.name;
        if (bErrors.email) mappedErrors['personalInfo.email'] = bErrors.email;
        setErrors(mappedErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 transition-colors duration-200">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Create Student Account</h1>
      
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            {(error.toLowerCase().includes('classes & student groups') || error.toLowerCase().includes('departments & sections')) && (
              <div className="mt-2">
                <Link
                  to="/admin/classes"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-800 dark:text-rose-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Open Departments & Sections</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
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

        <div>
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
                placeholder="e.g. John Doe"
              />
              {errors['personalInfo.name'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['personalInfo.name']}</p>
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
                placeholder="e.g. john.doe@university.edu"
              />
              {errors['personalInfo.email'] && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors['personalInfo.email']}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Academic Information</h3>
            {derivedYearOfStudy && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                <Layers className="w-3 h-3" />
                <span>{derivedYearOfStudy}</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Course <span className="text-rose-500">*</span>
              </label>
              <select
                value={courseSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setCourseSelect(val);
                  if (errors.course) setErrors(prev => { const u = {...prev}; delete u.course; return u; });
                  if (val !== 'Other') setFormData(prev => ({ ...prev, course: val }));
                  else setFormData(prev => ({ ...prev, course: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                  errors.course ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <option value="">Select Course</option>
                {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other</option>
              </select>
              {courseSelect === 'Other' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                  <input
                    type="text"
                    name="course"
                    value={formData.course}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                      errors.course ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Enter custom course"
                  />
                </div>
              )}
              {errors.course && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.course}</p>
              )}
            </div>

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
                  if (val === 'Other') {
                    setFormData(prev => ({ ...prev, department: '' }));
                  } else {
                    setFormData(prev => ({ ...prev, department: val }));
                  }
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
                Semester <span className="text-rose-500">*</span>
              </label>
              <select
                value={semesterSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setSemesterSelect(val);
                  if (errors.semester) setErrors(prev => { const u = {...prev}; delete u.semester; return u; });
                  if (val !== 'Other') setFormData(prev => ({ ...prev, semester: val }));
                  else setFormData(prev => ({ ...prev, semester: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                  errors.semester ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <option value="">Select Semester</option>
                {semestersList.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Other">Other</option>
              </select>
              {semesterSelect === 'Other' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                  <input
                    type="text"
                    name="semester"
                    value={formData.semester}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                      errors.semester ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="Enter custom semester"
                  />
                </div>
              )}
              {errors.semester && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.semester}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Academic Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.academicYear ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. 2026-2027"
              />
              {errors.academicYear && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.academicYear}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Section <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                    errors.section ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                  }`}
                  placeholder="e.g. A, B, or C"
                />
                
                {/* Configured sections helper */}
                {matchingSections.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">Configured sections:</span>
                    {matchingSections.map(sec => (
                      <button
                        type="button"
                        key={sec._id}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, section: sec.section }));
                          if (errors.section) setErrors(prev => { const u = {...prev}; delete u.section; return u; });
                        }}
                        className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                          formData.section.toLowerCase() === sec.section.toLowerCase()
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Section {sec.section}
                      </button>
                    ))}
                  </div>
                ) : formData.course && formData.department && formData.semester ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between gap-2">
                    <span>No sections configured for this department & semester yet.</span>
                    <Link
                      to="/admin/classes"
                      className="shrink-0 font-semibold underline hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-1"
                    >
                      <span>Configure Sections</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ) : null}
              </div>
              {errors.section && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.section}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Account Credentials</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Student Login ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                autoComplete="off"
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.studentId ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="e.g. s2026001"
              />
              {errors.studentId && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.studentId}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Initial Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.password ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="Min 8 chars, letter + number/symbol"
              />
              {errors.password && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.password}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                className={`w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.confirmPassword ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                }`}
                placeholder="Re-enter initial password"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2 cursor-pointer disabled:opacity-70 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Student Account
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
          >
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}
