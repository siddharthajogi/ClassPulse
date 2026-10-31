import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import {
  ArrowLeft,
  User,
  Briefcase,
  ShieldCheck,
  Mail,
  Hash,
  Phone,
  MapPin,
  Building2,
  Award,
  BookOpen,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit3,
  X,
  Clock
} from 'lucide-react';
import QualificationMultiSelect from './QualificationMultiSelect';

export default function TeacherProfile() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Comprehensive Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // 1. Personal Information Edit Modal State
  const [isEditPersonalOpen, setIsEditPersonalOpen] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState('');
  const [personalFormData, setPersonalFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // 2. Professional Information Edit Modal State
  const [isEditProfessionalOpen, setIsEditProfessionalOpen] = useState(false);
  const [professionalSaving, setProfessionalSaving] = useState(false);
  const [professionalError, setProfessionalError] = useState('');
  const [professionalFormData, setProfessionalFormData] = useState({
    department: '',
    designation: '',
    qualifications: [],
    highestQualification: '',
    specialization: '',
    yearsOfExperience: ''
  });

  const [profDepartmentSelect, setProfDepartmentSelect] = useState('');
  const [profDesignationSelect, setProfDesignationSelect] = useState('');
  const [profQualificationSelect, setProfQualificationSelect] = useState('');
  const [profSpecializationSelect, setProfSpecializationSelect] = useState('');

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [designationSelect, setDesignationSelect] = useState('');
  const [qualificationSelect, setQualificationSelect] = useState('');
  const [specializationSelect, setSpecializationSelect] = useState('');

  const designationsList = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Head of Department'];
  const qualificationsList = ['Ph.D.', 'M.Tech', 'M.Sc.', 'MCA', 'M.Phil', 'B.Tech', 'B.Sc.'];
  const specializationsList = [
    'Artificial Intelligence',
    'Machine Learning',
    'Data Science',
    'Cybersecurity',
    'Cloud Computing',
    'Software Engineering',
    'VLSI & Embedded Systems',
    'Power Systems',
    'Thermal Engineering',
    'Structural Engineering'
  ];

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    department: '',
    designation: '',
    qualifications: [],
    highestQualification: '',
    specialization: '',
    yearsOfExperience: ''
  });

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError('');
    try {
      const deptRes = await adminApi.getDepartments();
      if (deptRes.success) {
        setDepartments(deptRes.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments in TeacherProfile:', err);
      setDeptError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchTeacherData = async () => {
    setLoading(true);
    setError('');
    try {
      fetchDepartments();
      const res = await adminApi.getTeacherById(id);
      if (res.success && res.teacher) {
        setTeacher(res.teacher);
      } else {
        setError('Teacher profile not found.');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Teacher profile not found.');
      } else {
        setError(err.response?.data?.error || 'Failed to load teacher profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  usePageRefresh(fetchTeacherData, [id]);

  useEffect(() => {
    fetchTeacherData();
  }, [id]);

  // Sync selected department in edit modal if departments finish loading after modal opens
  useEffect(() => {
    if ((isEditOpen || isEditProfessionalOpen) && teacher && departments.length > 0) {
      const deptVal = teacher.department || '';
      const deptRefId = teacher.departmentRef ? (teacher.departmentRef._id || teacher.departmentRef) : null;
      const matched = departments.find(d =>
        (d._id && String(d._id) === String(deptVal)) ||
        (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
        (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
        (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
      );
      if (matched) {
        if (isEditOpen && departmentSelect !== matched._id) {
          setDepartmentSelect(matched._id);
          setEditFormData(prev => ({ ...prev, department: matched._id }));
        }
        if (isEditProfessionalOpen && profDepartmentSelect !== matched._id) {
          setProfDepartmentSelect(matched._id);
          setProfessionalFormData(prev => ({ ...prev, department: matched._id }));
        }
      }
    }
  }, [departments, isEditOpen, isEditProfessionalOpen, teacher]);

  const resolveTeacherDept = () => {
    if (teacher?.departmentRef && teacher.departmentRef.name) return teacher.departmentRef.name;
    if (!teacher?.department) return '—';
    const matched = departments.find(d =>
      (d._id && String(d._id) === String(teacher.department)) ||
      (d.code && d.code.toLowerCase() === String(teacher.department).toLowerCase()) ||
      (d.name && d.name.toLowerCase() === String(teacher.department).toLowerCase())
    );
    return matched ? matched.name : teacher.department;
  };

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

  // 1. Personal Information Edit handlers
  const handleOpenEditPersonal = () => {
    if (!teacher) return;
    setPersonalFormData({
      name: teacher.user?.name || teacher.personalInfo?.name || '',
      email: teacher.personalInfo?.email || '',
      phone: teacher.personalInfo?.phone || '',
      address: teacher.personalInfo?.address || ''
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
      if (!personalFormData.name.trim()) throw new Error('Full Name is required.');
      if (!personalFormData.email.trim()) throw new Error('Email Address is required.');
      if (!personalFormData.phone.trim()) throw new Error('Phone Number is required.');
      if (!personalFormData.address.trim()) throw new Error('Address is required.');

      const payload = {
        department: teacher.department,
        designation: teacher.designation,
        personalInfo: {
          name: personalFormData.name.trim(),
          email: personalFormData.email.trim().toLowerCase(),
          phone: personalFormData.phone.trim(),
          address: personalFormData.address.trim()
        },
        professionalInfo: {
          highestQualification: teacher.professionalInfo?.highestQualification || 'B.Tech',
          specialization: teacher.professionalInfo?.specialization || 'Software Engineering',
          yearsOfExperience: teacher.professionalInfo?.yearsOfExperience ?? 0
        }
      };

      const res = await adminApi.updateTeacher(teacher._id, payload);
      if (res.success) {
        setIsEditPersonalOpen(false);
        setActionSuccess('Personal Information updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchTeacherData();
      }
    } catch (err) {
      setPersonalError(err.response?.data?.error || err.message || 'Failed to update personal information.');
    } finally {
      setPersonalSaving(false);
    }
  };

  // 2. Professional Information Edit handlers
  const handleOpenEditProfessional = () => {
    if (!teacher) return;

    const deptVal = teacher.department || '';
    const desigVal = teacher.designation || '';
    const qualList = Array.isArray(teacher.professionalInfo?.qualifications) && teacher.professionalInfo.qualifications.length > 0
      ? teacher.professionalInfo.qualifications
      : (teacher.professionalInfo?.highestQualification ? teacher.professionalInfo.highestQualification.split(',').map((s) => s.trim()).filter(Boolean) : []);
    const specVal = teacher.professionalInfo?.specialization || '';

    const deptMatches = departments.some((d) => d.code === deptVal || d.name === deptVal);
    setProfDepartmentSelect(deptMatches ? deptVal : (deptVal ? 'Other' : ''));
    setProfDesignationSelect(designationsList.includes(desigVal) ? desigVal : (desigVal ? 'Other' : ''));
    setProfSpecializationSelect(specializationsList.includes(specVal) ? specVal : (specVal ? 'Other' : ''));

    setProfessionalFormData({
      department: deptVal,
      designation: desigVal,
      qualifications: qualList,
      highestQualification: qualList.join(', '),
      specialization: specVal,
      yearsOfExperience: teacher.professionalInfo?.yearsOfExperience ?? ''
    });

    setProfessionalError('');
    setIsEditProfessionalOpen(true);
  };

  const handleCancelProfessionalEdit = () => {
    setIsEditProfessionalOpen(false);
    setProfessionalError('');
  };

  const handleSaveProfessionalEdit = async (e) => {
    e.preventDefault();
    setProfessionalError('');
    setProfessionalSaving(true);

    try {
      const finalQuals = professionalFormData.qualifications || [];
      const finalSpec = professionalFormData.specialization.trim();
      const exp = professionalFormData.yearsOfExperience;

      if (!finalDept) throw new Error('Department is required.');
      if (!finalDesig) throw new Error('Designation is required.');
      if (finalQuals.length === 0) throw new Error('Please select at least one qualification.');
      if (!finalSpec) throw new Error('Specialization is required.');
      if (exp === '' || exp === null || exp === undefined) throw new Error('Years of experience is required.');

      const payload = {
        department: finalDept,
        designation: finalDesig,
        personalInfo: {
          name: teacher.user?.name || teacher.personalInfo?.name || '',
          email: teacher.personalInfo?.email || '',
          phone: teacher.personalInfo?.phone || '',
          address: teacher.personalInfo?.address || ''
        },
        professionalInfo: {
          qualifications: finalQuals,
          highestQualification: finalQuals.join(', '),
          specialization: finalSpec,
          yearsOfExperience: Number(exp)
        }
      };

      const res = await adminApi.updateTeacher(teacher._id, payload);
      if (res.success) {
        setIsEditProfessionalOpen(false);
        setActionSuccess('Professional Details updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchTeacherData();
      }
    } catch (err) {
      setProfessionalError(err.response?.data?.error || err.message || 'Failed to update professional details.');
    } finally {
      setProfessionalSaving(false);
    }
  };

  // 3. Full Teacher Edit Modal
  const handleOpenEdit = () => {
    if (!teacher) return;

    const deptVal = teacher.department || '';
    const deptRefId = teacher.departmentRef ? (teacher.departmentRef._id || teacher.departmentRef) : null;
    const desigVal = teacher.designation || '';
    const qualList = Array.isArray(teacher.professionalInfo?.qualifications) && teacher.professionalInfo.qualifications.length > 0
      ? teacher.professionalInfo.qualifications
      : (teacher.professionalInfo?.highestQualification ? teacher.professionalInfo.highestQualification.split(',').map((s) => s.trim()).filter(Boolean) : []);
    const specVal = teacher.professionalInfo?.specialization || '';

    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(deptVal)) ||
      (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
      (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
      (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
    );
    const initialDeptId = matchedDept ? matchedDept._id : (deptVal ? 'Other' : '');
    setDepartmentSelect(initialDeptId);
    setDesignationSelect(designationsList.includes(desigVal) ? desigVal : (desigVal ? 'Other' : ''));
    setSpecializationSelect(specializationsList.includes(specVal) ? specVal : (specVal ? 'Other' : ''));

    setEditFormData({
      name: teacher.user?.name || teacher.personalInfo?.name || '',
      email: teacher.personalInfo?.email || '',
      phone: teacher.personalInfo?.phone || '',
      address: teacher.personalInfo?.address || '',
      department: matchedDept ? matchedDept._id : deptVal,
      designation: desigVal,
      qualifications: qualList,
      highestQualification: qualList.join(', '),
      specialization: specVal,
      yearsOfExperience: teacher.professionalInfo?.yearsOfExperience ?? ''
    });

    setEditError('');
    setIsEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);

    try {
      const finalQuals = editFormData.qualifications || [];
      if (finalQuals.length === 0) {
        throw new Error('Please select at least one qualification.');
      }

      const payload = {
        department: editFormData.department.trim(),
        designation: editFormData.designation.trim(),
        personalInfo: {
          name: editFormData.name.trim(),
          email: editFormData.email.trim().toLowerCase(),
          phone: editFormData.phone.trim(),
          address: editFormData.address.trim()
        },
        professionalInfo: {
          qualifications: finalQuals,
          highestQualification: finalQuals.join(', '),
          specialization: editFormData.specialization.trim(),
          yearsOfExperience: Number(editFormData.yearsOfExperience)
        }
      };

      const res = await adminApi.updateTeacher(teacher._id, payload);
      if (res.success) {
        setIsEditOpen(false);
        setActionSuccess('Teacher profile updated successfully!');
        setTimeout(() => setActionSuccess(''), 4000);
        await fetchTeacherData();
      }
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update teacher profile.');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-base font-medium">Loading teacher profile...</p>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <Link
            to="/admin/teachers"
            className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Manage Teachers
          </Link>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Teacher Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error || 'The requested teacher profile could not be located.'}</p>
          <Link
            to="/admin/teachers"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Return to Manage Teachers
          </Link>
        </div>
      </div>
    );
  }

  const fullName = teacher.user?.name || teacher.personalInfo?.name;
  const displayName = fullName && fullName.trim() !== '' ? fullName : teacher.teacherId;
  const isActive = teacher.user?.isActive ?? true;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/admin/teachers"
          className="inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Manage Teachers
        </Link>
        <button
          onClick={handleOpenEdit}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Edit3 className="w-4 h-4" /> Edit Teacher
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-6 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
            <Briefcase className="w-10 h-10" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
                {displayName}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {isActive ? 'Active Account' : 'Inactive Account'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {teacher.teacherId}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {displayVal(teacher.department)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Award className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {displayVal(teacher.designation)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Personal Information</h2>
          </div>

          <dl className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Full Name</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {displayVal(teacher.user?.name || teacher.personalInfo?.name)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Teacher / Faculty ID</dt>
              <dd className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {displayVal(teacher.teacherId)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Email Address</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-200 sm:text-right flex items-center sm:justify-end gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                {displayVal(teacher.personalInfo?.email)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Phone Number</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-200 sm:text-right flex items-center sm:justify-end gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                {displayVal(teacher.personalInfo?.phone)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Address</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-200 sm:text-right sm:max-w-xs break-words">
                {displayVal(teacher.personalInfo?.address)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Professional Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Professional Information</h2>
          </div>

          <dl className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Department</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {displayVal(resolveTeacherDept())}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Designation</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {displayVal(teacher.designation)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1 sm:items-center">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Qualifications</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {Array.isArray(teacher.professionalInfo?.qualifications) && teacher.professionalInfo.qualifications.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                    {teacher.professionalInfo.qualifications.map((q, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                ) : teacher.professionalInfo?.highestQualification ? (
                  <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                    {teacher.professionalInfo.highestQualification.split(',').map((q, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                      >
                        {q.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-50 dark:border-slate-800/60 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Specialization</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {displayVal(teacher.professionalInfo?.specialization)}
              </dd>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Years of Experience</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200 sm:text-right">
                {teacher.professionalInfo?.yearsOfExperience !== undefined &&
                teacher.professionalInfo?.yearsOfExperience !== null &&
                teacher.professionalInfo?.yearsOfExperience !== ''
                  ? `${teacher.professionalInfo.yearsOfExperience} years`
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Account Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 lg:col-span-2 transition-colors duration-200">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
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
                  isActive ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
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
                {displayVal(teacher.user?.userId || teacher.teacherId)}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                System Role
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                {displayVal(teacher.user?.role || 'teacher')}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Created On
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                {formatDate(teacher.user?.createdAt || teacher.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Teacher Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Teacher Profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Teacher ID: {teacher.teacherId} (Read-only)</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              {editError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
                  Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={editFormData.address}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
                  Professional Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      {loadingDepts && (
                        <span className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Loading...</span>
                        </span>
                      )}
                      {deptError && (
                        <button
                          type="button"
                          onClick={fetchDepartments}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                    </div>
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
                      {loadingDepts ? (
                        <option value="" disabled>Loading departments...</option>
                      ) : deptError ? (
                        <option value="" disabled>Error loading departments</option>
                      ) : departments.length === 0 ? (
                        <option value="" disabled>No departments available. Create a department first.</option>
                      ) : (
                        departments
                          .filter(d => d && (d.name || d._id))
                          .map((d) => (
                            <option key={d._id || d.name} value={d._id || d.name}>
                              {d.name || d.code || 'Unnamed Department'}
                            </option>
                          ))
                      )}
                      <option value="Other">Other (Custom)</option>
                    </select>
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
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Designation <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={designationSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDesignationSelect(val);
                        if (val !== 'Other') {
                          setEditFormData((prev) => ({ ...prev, designation: val }));
                        } else {
                          setEditFormData((prev) => ({ ...prev, designation: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Designation</option>
                      {designationsList.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      <option value="Other">Other (Custom)</option>
                    </select>
                    {designationSelect === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter designation"
                        value={editFormData.designation}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, designation: e.target.value }))}
                        required
                        className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <QualificationMultiSelect
                      id="teacher-profile-edit-qualifications"
                      selected={editFormData.qualifications || []}
                      onChange={(newQualifications) => {
                        setEditFormData((prev) => ({
                          ...prev,
                          qualifications: newQualifications,
                          highestQualification: newQualifications.join(', ')
                        }));
                      }}
                      required={true}
                      label="Qualifications"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Specialization <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={specializationSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSpecializationSelect(val);
                        if (val !== 'Other') {
                          setEditFormData((prev) => ({ ...prev, specialization: val }));
                        } else {
                          setEditFormData((prev) => ({ ...prev, specialization: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Specialization</option>
                      {specializationsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="Other">Other (Custom)</option>
                    </select>
                    {specializationSelect === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter specialization"
                        value={editFormData.specialization}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, specialization: e.target.value }))}
                        required
                        className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Years of Experience <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="yearsOfExperience"
                      min="0"
                      max="60"
                      value={editFormData.yearsOfExperience}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
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
