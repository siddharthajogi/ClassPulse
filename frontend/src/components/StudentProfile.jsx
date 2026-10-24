import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../api';
import { 
  ArrowLeft, 
  User, 
  GraduationCap, 
  ShieldCheck, 
  Mail, 
  Hash, 
  Calendar, 
  Building2, 
  BookOpen, 
  Layers, 
  CalendarRange, 
  Bookmark, 
  Phone, 
  MapPin, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  X,
  Clock
} from 'lucide-react';

export default function StudentProfile() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Comprehensive Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Personal Info Edit Modal State
  const [isEditPersonalOpen, setIsEditPersonalOpen] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState('');
  const [personalFormData, setPersonalFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: ''
  });

  // Academic Info Edit Modal State
  const [isEditAcademicOpen, setIsEditAcademicOpen] = useState(false);
  const [academicSaving, setAcademicSaving] = useState(false);
  const [academicError, setAcademicError] = useState('');
  const [academicFormData, setAcademicFormData] = useState({
    course: '',
    department: '',
    academicYear: '',
    semester: '',
    section: '',
    batch: ''
  });

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [courseSelect, setCourseSelect] = useState('');
  const [semesterSelect, setSemesterSelect] = useState('');

  const [academicDeptSelect, setAcademicDeptSelect] = useState('');
  const [academicCourseSelect, setAcademicCourseSelect] = useState('');
  const [academicSemesterSelect, setAcademicSemesterSelect] = useState('');

  const coursesList = ['B.Tech', 'M.Tech', 'Ph.D.', 'B.Sc.', 'M.Sc.', 'BCA', 'MCA'];
  const semestersList = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  const [editFormData, setEditFormData] = useState({
    course: '',
    department: '',
    academicYear: '',
    semester: '',
    section: '',
    batch: '',
    personalInfo: {
      name: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      address: ''
    }
  });

  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');

  const fetchDepartments = async () => {
    try {
      setLoadingDepts(true);
      setDeptError('');
      const deptRes = await adminApi.getDepartments();
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      } else {
        setDeptError(deptRes?.error || 'Failed to load departments');
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDeptError(err.response?.data?.error || err.message || 'Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchStudentData = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, deptRes] = await Promise.all([
        adminApi.getStudentById(id),
        adminApi.getDepartments()
      ]);
      if (res.success && res.student) {
        setStudent(res.student);
      } else {
        setError('Student profile not found.');
      }
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      } else if (deptRes && !deptRes.success) {
        setDeptError(deptRes.error || 'Failed to load departments');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Student profile not found.');
      } else {
        setError(err.response?.data?.error || 'Failed to load student profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  // Display helper: displays "—" for missing, null, empty or undefined values
  const displayVal = (val) => {
    if (val === undefined || val === null) return '—';
    const str = String(val).trim();
    return str === '' ? '—' : str;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (_) {
      return '—';
    }
  };

  const toInputDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (_) {
      return '';
    }
  };

  // 1. Personal Information Edit handlers
  const handleOpenEditPersonal = () => {
    if (!student) return;
    setPersonalFormData({
      name: student.user?.name || student.personalInfo?.name || '',
      email: student.personalInfo?.email || '',
      phone: student.personalInfo?.phone || '',
      dateOfBirth: toInputDate(student.personalInfo?.dateOfBirth),
      address: student.personalInfo?.address || ''
    });
    setPersonalError('');
    setIsEditPersonalOpen(true);
  };

  const handleCancelPersonalEdit = () => {
    setIsEditPersonalOpen(false);
    setPersonalError('');
  };

  const handleSavePersonalEdit = async (e) => {
    e.preventDefault();
    setPersonalError('');
    setPersonalSaving(true);

    try {
      if (!personalFormData.name.trim()) {
        throw new Error('Full Name is required.');
      }
      if (!personalFormData.email.trim()) {
        throw new Error('Email Address is required.');
      }

      const payload = {
        studentId: student.studentId,
        personalInfo: {
          name: personalFormData.name.trim(),
          email: personalFormData.email.trim().toLowerCase(),
          phone: personalFormData.phone.trim(),
          dateOfBirth: personalFormData.dateOfBirth || null,
          address: personalFormData.address.trim()
        }
      };

      const res = await adminApi.updateStudent(student._id, payload);
      if (res.success) {
        setIsEditPersonalOpen(false);
        setActionSuccess('Personal Information updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchStudentData();
      }
    } catch (err) {
      setPersonalError(err.response?.data?.error || err.message || 'Failed to update personal information.');
    } finally {
      setPersonalSaving(false);
    }
  };

  // 2. Academic Information Edit handlers
  const handleOpenEditAcademic = () => {
    if (!student) return;
    if (departments.length === 0 && !loadingDepts) {
      fetchDepartments();
    }

    const deptVal = student.department || (student.classRef && student.classRef.department) || (student.departmentRef && student.departmentRef.name) || '';
    const courseVal = student.course || '';
    const semVal = student.semester || '';

    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(deptVal)) ||
      (d.name && d.name.toLowerCase().trim() === String(deptVal).toLowerCase().trim()) ||
      (d.code && d.code.toLowerCase().trim() === String(deptVal).toLowerCase().trim()) ||
      (student.classRef?.department && d.name.toLowerCase().trim() === student.classRef.department.toLowerCase().trim()) ||
      (student.departmentRef?._id && d._id && String(d._id) === String(student.departmentRef._id))
    );

    const initialDeptId = matchedDept ? matchedDept._id : (deptVal ? 'Other' : '');
    setAcademicDeptSelect(initialDeptId);

    const isCourseKnown = coursesList.includes(courseVal);
    setAcademicCourseSelect(isCourseKnown ? courseVal : (courseVal ? 'Other' : ''));

    const isSemKnown = semestersList.includes(semVal);
    setAcademicSemesterSelect(isSemKnown ? semVal : (semVal ? 'Other' : ''));

    setAcademicFormData({
      course: courseVal,
      department: matchedDept ? matchedDept._id : (deptVal || ''),
      academicYear: student.academicYear || '',
      semester: semVal,
      section: student.section || '',
      batch: student.batch || ''
    });
    setAcademicError('');
    setIsEditAcademicOpen(true);
  };

  const handleCancelAcademicEdit = () => {
    setIsEditAcademicOpen(false);
    setAcademicError('');
  };

  const handleSaveAcademicEdit = async (e) => {
    e.preventDefault();
    setAcademicError('');
    setAcademicSaving(true);

    try {
      const finalDept = academicFormData.department.trim();
      const finalCourse = academicFormData.course.trim();
      const finalSem = academicFormData.semester.trim();
      const finalYear = academicFormData.academicYear.trim();
      const finalSec = academicFormData.section.trim();

      if (!finalCourse) throw new Error('Course is required.');
      if (!finalDept) throw new Error('Department is required.');
      if (!finalSem) throw new Error('Semester is required.');
      if (!finalYear) throw new Error('Academic Year is required.');
      if (!finalSec) throw new Error('Section is required.');

      const payload = {
        studentId: student.studentId,
        course: finalCourse,
        department: finalDept,
        academicYear: finalYear,
        semester: finalSem,
        section: finalSec,
        batch: academicFormData.batch.trim()
      };

      const res = await adminApi.updateStudent(student._id, payload);
      if (res.success) {
        setIsEditAcademicOpen(false);
        setActionSuccess('Academic Information updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchStudentData();
      }
    } catch (err) {
      setAcademicError(err.response?.data?.error || err.message || 'Failed to update academic information.');
    } finally {
      setAcademicSaving(false);
    }
  };

  // 3. Full Student Edit Modal
  const handleOpenEdit = () => {
    if (!student) return;
    if (departments.length === 0 && !loadingDepts) {
      fetchDepartments();
    }

    const deptVal = student.department || (student.classRef && student.classRef.department) || (student.departmentRef && student.departmentRef.name) || '';
    const courseVal = student.course || '';
    const semVal = student.semester || '';

    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(deptVal)) ||
      (d.name && d.name.toLowerCase().trim() === String(deptVal).toLowerCase().trim()) ||
      (d.code && d.code.toLowerCase().trim() === String(deptVal).toLowerCase().trim()) ||
      (student.classRef?.department && d.name.toLowerCase().trim() === student.classRef.department.toLowerCase().trim()) ||
      (student.departmentRef?._id && d._id && String(d._id) === String(student.departmentRef._id))
    );

    const initialDeptId = matchedDept ? matchedDept._id : (deptVal ? 'Other' : '');
    setDepartmentSelect(initialDeptId);

    const isCourseKnown = coursesList.includes(courseVal);
    setCourseSelect(isCourseKnown ? courseVal : (courseVal ? 'Other' : ''));

    const isSemKnown = semestersList.includes(semVal);
    setSemesterSelect(isSemKnown ? semVal : (semVal ? 'Other' : ''));

    setEditFormData({
      course: courseVal,
      department: matchedDept ? matchedDept._id : (deptVal || ''),
      academicYear: student.academicYear || '',
      semester: semVal,
      section: student.section || '',
      batch: student.batch || '',
      personalInfo: {
        name: student.user?.name || student.personalInfo?.name || '',
        email: student.personalInfo?.email || '',
        phone: student.personalInfo?.phone || '',
        dateOfBirth: toInputDate(student.personalInfo?.dateOfBirth),
        address: student.personalInfo?.address || ''
      }
    });

    setEditError('');
    setIsEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setEditFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);

    try {
      const payload = {
        studentId: student.studentId,
        course: editFormData.course.trim(),
        department: editFormData.department.trim(),
        academicYear: editFormData.academicYear.trim(),
        semester: editFormData.semester.trim(),
        section: editFormData.section.trim(),
        batch: editFormData.batch ? editFormData.batch.trim() : undefined,
        personalInfo: {
          name: editFormData.personalInfo.name.trim(),
          email: editFormData.personalInfo.email.trim().toLowerCase(),
          phone: editFormData.personalInfo.phone.trim(),
          dateOfBirth: editFormData.personalInfo.dateOfBirth || null,
          address: editFormData.personalInfo.address.trim()
        }
      };

      const res = await adminApi.updateStudent(student._id, payload);
      if (res.success) {
        setIsEditOpen(false);
        setActionSuccess('Student profile updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchStudentData();
      }
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update student profile.');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-base font-medium">Loading student profile...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <Link
            to="/admin/students"
            className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Manage Students
          </Link>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Student Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error || 'The requested student profile could not be located.'}</p>
          <Link
            to="/admin/students"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Return to Manage Students
          </Link>
        </div>
      </div>
    );
  }

  const fullName = student.user?.name || student.personalInfo?.name;
  const displayName = fullName && fullName.trim() !== '' ? fullName : student.studentId;
  const isActive = student.user?.isActive ?? true;

  return (
    <div className="max-w-5xl mx-auto pb-12 transition-colors duration-200">
      {/* Top Navigation */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/admin/students"
          className="inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Manage Students
        </Link>
        <button
          onClick={handleOpenEdit}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-slate-700 rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Edit3 className="w-4 h-4" /> Edit Student
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-6 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
            <GraduationCap className="w-10 h-10" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40'
                }`}
              >
                {isActive ? 'Active Account' : 'Inactive Account'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                <Hash className="w-4 h-4 text-slate-400" /> {student.studentId}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-slate-400" /> {displayVal(student.department)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-4 h-4 text-slate-400" /> {displayVal(student.course)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Personal Information</h2>
            </div>
            <button
              type="button"
              onClick={handleOpenEditPersonal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          <dl className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Full Name</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                {displayVal(student.user?.name || student.personalInfo?.name)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Student ID</dt>
              <dd className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                {displayVal(student.studentId)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Email Address</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100 sm:text-right flex items-center sm:justify-end gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {displayVal(student.personalInfo?.email)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Phone Number</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100 sm:text-right flex items-center sm:justify-end gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {displayVal(student.personalInfo?.phone)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Date of Birth</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100 sm:text-right">
                {formatDate(student.personalInfo?.dateOfBirth)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Address</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100 sm:text-right sm:max-w-xs break-words">
                {displayVal(student.personalInfo?.address)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Academic Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Academic Information</h2>
            </div>
            <button
              type="button"
              onClick={handleOpenEditAcademic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          <dl className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Course / Program</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                {displayVal(student.course)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Department</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                {(() => {
                  const raw = student.department || student.departmentRef?.name || (student.classRef && student.classRef.department) || '—';
                  const found = departments.find(d => String(d._id) === String(raw) || d.code === raw);
                  return displayVal(found ? found.name : raw);
                })()}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Semester</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                {displayVal(student.semester)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Academic Year</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-right flex items-center sm:justify-end gap-1">
                <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                {displayVal(student.academicYear)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Section</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                {displayVal(student.section)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Academic Group</dt>
              <dd className="text-sm font-bold text-indigo-600 dark:text-indigo-400 sm:text-right">
                {student.classRef?.name || `${displayVal(student.course)} - ${displayVal(student.department)} (Sec ${displayVal(student.section)})`}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Batch</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100 sm:text-right">
                {displayVal(student.batch)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Account Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 lg:col-span-2 transition-colors duration-200">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Account Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Account Status
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isActive ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                }`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Login ID
              </span>
              <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                {displayVal(student.user?.userId || student.studentId)}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                System Role
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                {displayVal(student.user?.role || 'student')}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Created On
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(student.user?.createdAt || student.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Edit Personal Information Modal */}
      {isEditPersonalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Personal Information</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Student ID: {student.studentId} (Read-only)</p>
              </div>
              <button
                onClick={handleCancelPersonalEdit}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePersonalEdit} className="p-6 space-y-4">
              {personalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{personalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={personalFormData.name}
                  onChange={(e) => setPersonalFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="Student Full Name"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={personalFormData.email}
                  onChange={(e) => setPersonalFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="student@example.edu"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={personalFormData.phone}
                  onChange={(e) => setPersonalFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={personalFormData.dateOfBirth}
                  onChange={(e) => setPersonalFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  rows="3"
                  value={personalFormData.address}
                  onChange={(e) => setPersonalFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Residential Address"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelPersonalEdit}
                  disabled={personalSaving}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={personalSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {personalSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Academic Information Modal */}
      {isEditAcademicOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Academic Information</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Student ID: {student.studentId}</p>
              </div>
              <button
                onClick={handleCancelAcademicEdit}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAcademicEdit} className="p-6 space-y-4">
              {academicError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{academicError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Course <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={academicCourseSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAcademicCourseSelect(val);
                      if (val !== 'Other') {
                        setAcademicFormData((prev) => ({ ...prev, course: val }));
                      } else {
                        setAcademicFormData((prev) => ({ ...prev, course: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Course</option>
                    {coursesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {academicCourseSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter course name"
                      value={academicFormData.course}
                      onChange={(e) => setAcademicFormData((prev) => ({ ...prev, course: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  {loadingDepts ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Loading departments...</span>
                    </div>
                  ) : deptError ? (
                    <div className="flex items-center justify-between p-2 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                      <span>{deptError}</span>
                      <button type="button" onClick={fetchDepartments} className="underline font-semibold ml-2 cursor-pointer">Retry</button>
                    </div>
                  ) : (
                    <select
                      value={academicDeptSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAcademicDeptSelect(val);
                        if (val !== 'Other') {
                          setAcademicFormData((prev) => ({ ...prev, department: val }));
                        } else {
                          setAcademicFormData((prev) => ({ ...prev, department: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Department</option>
                      {departments.length === 0 ? (
                        <option value="" disabled>No departments configured</option>
                      ) : (
                        departments.map((d) => {
                          const optVal = d._id || d.code || d.name;
                          const optLabel = (d.name && d.name.trim()) || (d.code && d.code.trim()) || 'Unnamed Department';
                          return (
                            <option key={optVal} value={optVal}>{optLabel}</option>
                          );
                        })
                      )}
                      <option value="Other">Other (Custom)</option>
                    </select>
                  )}
                  {academicDeptSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter custom department name"
                      value={academicFormData.department}
                      onChange={(e) => setAcademicFormData((prev) => ({ ...prev, department: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={academicSemesterSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAcademicSemesterSelect(val);
                      if (val !== 'Other') {
                        setAcademicFormData((prev) => ({ ...prev, semester: val }));
                      } else {
                        setAcademicFormData((prev) => ({ ...prev, semester: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Semester</option>
                    {semestersList.map((s) => (
                      <option key={s} value={s}>{s} Semester</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {academicSemesterSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter semester"
                      value={academicFormData.semester}
                      onChange={(e) => setAcademicFormData((prev) => ({ ...prev, semester: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={academicFormData.academicYear}
                    onChange={(e) => setAcademicFormData(prev => ({ ...prev, academicYear: e.target.value }))}
                    placeholder="e.g. 2025-2026"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Section <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={academicFormData.section}
                    onChange={(e) => setAcademicFormData(prev => ({ ...prev, section: e.target.value }))}
                    placeholder="e.g. A"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Batch
                  </label>
                  <input
                    type="text"
                    value={academicFormData.batch}
                    onChange={(e) => setAcademicFormData(prev => ({ ...prev, batch: e.target.value }))}
                    placeholder="e.g. 2023-2027"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelAcademicEdit}
                  disabled={academicSaving}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={academicSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {academicSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Comprehensive Edit Student Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Student Profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Student ID: {student.studentId} (Read-only)</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-5">
              {editError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Personal Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="personalInfo.name"
                    value={editFormData.personalInfo.name}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="personalInfo.email"
                    value={editFormData.personalInfo.email}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="personalInfo.phone"
                    value={editFormData.personalInfo.phone}
                    onChange={handleEditChange}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="personalInfo.dateOfBirth"
                    value={editFormData.personalInfo.dateOfBirth}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  rows="2"
                  name="personalInfo.address"
                  value={editFormData.personalInfo.address}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pt-2 border-t border-slate-100 dark:border-slate-800">
                Academic Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Course <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={courseSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCourseSelect(val);
                      if (val !== 'Other') {
                        setEditFormData((prev) => ({ ...prev, course: val }));
                      } else {
                        setEditFormData((prev) => ({ ...prev, course: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Course</option>
                    {coursesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {courseSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter course name"
                      value={editFormData.course}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, course: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  {loadingDepts ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Loading departments...</span>
                    </div>
                  ) : deptError ? (
                    <div className="flex items-center justify-between p-2 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                      <span>{deptError}</span>
                      <button type="button" onClick={fetchDepartments} className="underline font-semibold ml-2 cursor-pointer">Retry</button>
                    </div>
                  ) : (
                    <select
                      value={departmentSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDepartmentSelect(val);
                        if (val !== 'Other') {
                          setEditFormData((prev) => ({ ...prev, department: val }));
                        } else {
                          setEditFormData((prev) => ({ ...prev, department: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Department</option>
                      {departments.length === 0 ? (
                        <option value="" disabled>No departments configured</option>
                      ) : (
                        departments.map((d) => {
                          const optVal = d._id || d.code || d.name;
                          const optLabel = (d.name && d.name.trim()) || (d.code && d.code.trim()) || 'Unnamed Department';
                          return (
                            <option key={optVal} value={optVal}>{optLabel}</option>
                          );
                        })
                      )}
                      <option value="Other">Other (Custom)</option>
                    </select>
                  )}
                  {departmentSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter department name"
                      value={editFormData.department}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, department: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={semesterSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSemesterSelect(val);
                      if (val !== 'Other') {
                        setEditFormData((prev) => ({ ...prev, semester: val }));
                      } else {
                        setEditFormData((prev) => ({ ...prev, semester: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Semester</option>
                    {semestersList.map((s) => (
                      <option key={s} value={s}>{s} Semester</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {semesterSelect === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter semester"
                      value={editFormData.semester}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, semester: e.target.value }))}
                      required
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="academicYear"
                    value={editFormData.academicYear}
                    onChange={handleEditChange}
                    placeholder="e.g. 2025-2026"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Section <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="section"
                    value={editFormData.section}
                    onChange={handleEditChange}
                    placeholder="e.g. A"
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Batch
                  </label>
                  <input
                    type="text"
                    name="batch"
                    value={editFormData.batch}
                    onChange={handleEditChange}
                    placeholder="e.g. 2023-2027"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={editSaving}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
