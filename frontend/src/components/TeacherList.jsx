import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi } from '../api';
import { Loader2, Search, ShieldAlert, Pencil, X, AlertCircle, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import QualificationMultiSelect from './QualificationMultiSelect';

export default function TeacherList() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Delete Modal & Dependency State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [teacherDependencies, setTeacherDependencies] = useState(null);
  const [resolutionMode, setResolutionMode] = useState('unassign'); // 'unassign' | 'reassign'
  const [selectedReassignTeacherId, setSelectedReassignTeacherId] = useState('');

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    teacherId: '',
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
  const [departmentSelect, setDepartmentSelect] = useState('');
  const [designationSelect, setDesignationSelect] = useState('');
  const [specializationSelect, setSpecializationSelect] = useState('');

  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const designationsList = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Lab Assistant'];
  const qualificationsList = ['Ph.D.', 'M.Tech', 'M.E.', 'M.Sc.', 'B.Tech', 'B.E.'];
  const specializationsList = ['Computer Science', 'Data Science', 'Artificial Intelligence', 'Cyber Security', 'Electronics & Communication', 'Mechanical', 'Civil'];

  const fetchTeachers = async () => {
    try {
      const res = await adminApi.getTeachers();
      if (res.success) setTeachers(res.teachers);
    } catch (err) {
      setError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentsList = async () => {
    setLoadingDepts(true);
    setDeptError('');
    try {
      const res = await adminApi.getDepartments();
      if (res && res.success) setDepartments(res.departments || []);
    } catch (err) {
      console.error('Failed to load departments in TeacherList:', err);
      setDeptError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchDepartmentsList();
  }, []);

  // Sync selected department in Edit Teacher modal if departments finish loading after modal opens
  useEffect(() => {
    if (isEditOpen && editingTeacher && departments.length > 0) {
      const deptVal = editingTeacher.department || '';
      const deptRefId = editingTeacher.departmentRef ? (editingTeacher.departmentRef._id || editingTeacher.departmentRef) : null;
      const matched = departments.find(d =>
        (d._id && String(d._id) === String(deptVal)) ||
        (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
        (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
        (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
      );
      if (matched && departmentSelect !== matched._id) {
        setDepartmentSelect(matched._id);
        setEditFormData(prev => ({ ...prev, department: matched._id }));
      }
    }
  }, [departments, isEditOpen, editingTeacher]);

  const openEditModal = async (teacher) => {
    setEditError('');
    setEditSuccess('');
    setEditErrors({});
    setEditingTeacher(teacher);

    // Fetch fresh teacher data from MongoDB to ensure latest saved state
    try {
      const res = await adminApi.getTeacherById(teacher._id);
      const t = res.success ? res.teacher : teacher;

      const deptVal = t.department || '';
      const deptRefId = t.departmentRef ? (t.departmentRef._id || t.departmentRef) : null;
      const desigVal = t.designation || '';
      const specVal = t.professionalInfo?.specialization || '';
      const qualList = Array.isArray(t.professionalInfo?.qualifications) && t.professionalInfo.qualifications.length > 0
        ? t.professionalInfo.qualifications
        : (t.professionalInfo?.highestQualification ? t.professionalInfo.highestQualification.split(',').map(s => s.trim()).filter(Boolean) : []);

      // Match department by MongoDB _id, code, or name
      const matchedDept = departments.find(d =>
        (d._id && String(d._id) === String(deptVal)) ||
        (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
        (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
        (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
      );
      const initialDeptId = matchedDept ? matchedDept._id : (deptVal ? 'Other' : '');
      setDepartmentSelect(initialDeptId);

      const desigMatches = designationsList.includes(desigVal);
      setDesignationSelect(desigMatches ? desigVal : (desigVal ? 'Other' : ''));

      const specMatches = specializationsList.includes(specVal);
      setSpecializationSelect(specMatches ? specVal : (specVal ? 'Other' : ''));

      setEditFormData({
        name: t.user?.name || t.personalInfo?.name || '',
        teacherId: t.teacherId || '',
        email: t.personalInfo?.email || '',
        phone: t.personalInfo?.phone || '',
        address: t.personalInfo?.address || '',
        department: matchedDept ? matchedDept._id : deptVal,
        designation: desigVal,
        qualifications: qualList,
        highestQualification: qualList.join(', '),
        specialization: specVal,
        yearsOfExperience: t.professionalInfo?.yearsOfExperience ?? ''
      });

      setIsEditOpen(true);
    } catch (err) {
      // Fallback to row data if getTeacherById fails
      const deptVal = teacher.department || '';
      const deptRefId = teacher.departmentRef ? (teacher.departmentRef._id || teacher.departmentRef) : null;
      const desigVal = teacher.designation || '';
      const specVal = teacher.professionalInfo?.specialization || '';
      const qualList = Array.isArray(teacher.professionalInfo?.qualifications) && teacher.professionalInfo.qualifications.length > 0
        ? teacher.professionalInfo.qualifications
        : (teacher.professionalInfo?.highestQualification ? teacher.professionalInfo.highestQualification.split(',').map(s => s.trim()).filter(Boolean) : []);

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
        teacherId: teacher.teacherId || '',
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
      setIsEditOpen(true);
    }
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingTeacher(null);
    setEditErrors({});
    setEditError('');
    setEditSuccess('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (editErrors[name]) {
      setEditErrors((prev) => {
        const u = { ...prev };
        delete u[name];
        return u;
      });
    }
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateEdit = () => {
    const errs = {};
    if (!editFormData.name || !editFormData.name.trim()) errs.name = 'Full Name is required';
    if (!editFormData.email || !editFormData.email.trim()) {
      errs.email = 'Email Address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email.trim())) {
      errs.email = 'Please provide a valid email address';
    }
    if (!editFormData.phone || !editFormData.phone.trim()) {
      errs.phone = 'Phone Number is required';
    } else if (!/^(?:\+?91[\-\s]?)?[6-9]\d{9}$|^[0-9]{10}$/.test(editFormData.phone.trim())) {
      errs.phone = 'Please provide a valid 10-digit phone number';
    }
    if (!editFormData.address || !editFormData.address.trim()) errs.address = 'Address is required';

    if (!departmentSelect || departmentSelect === 'Select Department') {
      errs.department = 'Department is required';
    } else if (departmentSelect === 'Other' && (!editFormData.department || !editFormData.department.trim())) {
      errs.department = 'Please specify custom department';
    }

    if (!designationSelect || designationSelect === 'Select Designation') {
      errs.designation = 'Designation is required';
    } else if (designationSelect === 'Other' && (!editFormData.designation || !editFormData.designation.trim())) {
      errs.designation = 'Please specify custom designation';
    }

    if (!editFormData.qualifications || editFormData.qualifications.length === 0) {
      errs.qualifications = 'Qualification is required';
    }

    if (!specializationSelect || specializationSelect === 'Select Specialization') {
      errs.specialization = 'Specialization is required';
    } else if (specializationSelect === 'Other' && (!editFormData.specialization || !editFormData.specialization.trim())) {
      errs.specialization = 'Please specify custom specialization';
    }

    const expStr = String(editFormData.yearsOfExperience ?? '').trim();
    if (expStr === '') {
      errs.yearsOfExperience = 'Years of Experience is required';
    } else {
      const expNum = Number(expStr);
      if (isNaN(expNum) || expNum < 0 || expNum > 60) {
        errs.yearsOfExperience = 'Experience must be a number between 0 and 60';
      }
    }

    return errs;
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    const validationErrors = validateEdit();
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      setEditError('Please fill in all mandatory fields correctly.');
      return;
    }

    setEditLoading(true);
    try {
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
          qualifications: editFormData.qualifications,
          highestQualification: (editFormData.qualifications || []).join(', '),
          specialization: editFormData.specialization.trim(),
          yearsOfExperience: Number(editFormData.yearsOfExperience)
        }
      };

      const res = await adminApi.updateTeacher(editingTeacher._id, payload);
      if (res.success) {
        await fetchTeachers();
        closeEditModal();
      }
    } catch (err) {
      const backendError = err.response?.data?.error || 'Failed to update teacher';
      setEditError(backendError);
      if (err.response?.data?.errors) {
        const bErrs = { ...err.response.data.errors };
        if (bErrs.highestQualification) bErrs.qualifications = bErrs.highestQualification;
        setEditErrors(bErrs);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const toggleStatus = async (teacher) => {
    if (!window.confirm(`Are you sure you want to ${teacher.user.isActive ? 'deactivate' : 'activate'} this teacher?`)) return;
    try {
      await adminApi.updateUserStatus(teacher.user._id, !teacher.user.isActive);
      fetchTeachers();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const resetPassword = async (teacher) => {
    const newPassword = prompt(`Enter new temporary password for ${teacher.teacherId} (Min 8 chars, 1 letter, 1 number/symbol):`);
    if (!newPassword) return;
    try {
      await adminApi.resetUserPassword(teacher.user._id, newPassword);
      alert('Password reset successfully. User must change it on next login.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const openDeleteModal = async (teacher) => {
    setTeacherToDelete(teacher);
    setDeleteError('');
    setTeacherDependencies(null);
    setResolutionMode('unassign');
    setSelectedReassignTeacherId('');
    setDeleteModalOpen(true);
    setLoadingDependencies(true);

    try {
      const res = await adminApi.getTeacherDependencies(teacher._id);
      if (res.success) {
        setTeacherDependencies(res);
        if (res.eligibleReassignTeachers && res.eligibleReassignTeachers.length > 0) {
          setSelectedReassignTeacherId(res.eligibleReassignTeachers[0]._id);
        }
      }
    } catch (err) {
      console.warn('Failed to pre-check teacher dependencies:', err);
    } finally {
      setLoadingDependencies(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setTeacherToDelete(null);
    setDeleteError('');
    setTeacherDependencies(null);
    setResolutionMode('unassign');
    setSelectedReassignTeacherId('');
  };

  const confirmDelete = async (actionType = 'delete') => {
    if (!teacherToDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');

    const options = { action: actionType };
    if (teacherDependencies && teacherDependencies.hasDependencies) {
      if (resolutionMode === 'reassign' && selectedReassignTeacherId) {
        options.reassignToTeacherId = selectedReassignTeacherId;
      } else {
        options.unassignAssignments = true;
      }
    }

    try {
      const res = await adminApi.deleteTeacher(teacherToDelete._id, options);
      if (res.success) {
        const tName = teacherToDelete.user?.name || teacherToDelete.personalInfo?.name || teacherToDelete.teacherId;
        setActionSuccess(res.message || `Teacher "${tName}" was successfully processed.`);
        closeDeleteModal();
        fetchTeachers();
        setTimeout(() => setActionSuccess(''), 5000);
      } else {
        setDeleteError(res.error || 'Failed to delete teacher');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete teacher');
    } finally {
      setDeleting(false);
    }
  };

  const resolveDeptName = (t) => {
    if (t.departmentRef && t.departmentRef.name) return t.departmentRef.name;
    if (!t.department) return '—';
    const matched = departments.find(d =>
      (d._id && String(d._id) === String(t.department)) ||
      (d.code && d.code.toLowerCase() === String(t.department).toLowerCase()) ||
      (d.name && d.name.toLowerCase() === String(t.department).toLowerCase())
    );
    return matched ? matched.name : t.department;
  };

  const filtered = teachers.filter(t => 
    t.teacherId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error) return <div className="text-rose-600 bg-rose-50 p-4 rounded-lg">{error}</div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-8rem)] transition-colors duration-200">
      {actionSuccess && (
        <div className="m-4 mb-0 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-end items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search teachers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 w-full text-sm"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 sticky top-0 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium">Teacher ID</th>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium">Designation</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((t) => (
              <tr
                key={t._id}
                onClick={() => navigate(`/admin/teachers/${t._id}`)}
                className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                title="Click to view teacher profile"
              >
                <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <Link
                    to={`/admin/teachers/${t._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {t.teacherId}
                  </Link>
                </td>
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                  <Link
                    to={`/admin/teachers/${t._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {t.user?.name || 'Name not available'}
                  </Link>
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{resolveDeptName(t)}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{t.designation}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${t.user?.isActive ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                    {t.user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td
                  className="px-6 py-4 text-right flex justify-end items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEditModal(t)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                    title="Edit Teacher Profile"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(t)}
                    className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium cursor-pointer"
                  >
                    {t.user?.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => resetPassword(t)}
                    className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" /> Reset Pwd
                  </button>
                  <button
                    onClick={() => openDeleteModal(t)}
                    className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                    title="Permanently Delete Teacher"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No teachers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Teacher Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/60">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Teacher Profile</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">ID: {editFormData.teacherId}</p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Personal Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 dark:border-slate-800">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {editErrors.name && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Teacher/Faculty ID (Read-only)
                    </label>
                    <input
                      type="text"
                      value={editFormData.teacherId}
                      disabled
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 cursor-not-allowed border-slate-300 dark:border-slate-700"
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
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.email ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {editErrors.email && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.email}</p>
                    )}
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
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.phone ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {editErrors.phone && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.phone}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Address <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      name="address"
                      value={editFormData.address}
                      onChange={handleEditChange}
                      rows={2}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.address ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {editErrors.address && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 dark:border-slate-800">
                  Professional Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          onClick={fetchDepartmentsList}
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
                        if (editErrors.department) {
                          setEditErrors(prev => { const u = {...prev}; delete u.department; return u; });
                        }
                        if (val !== 'Other') setEditFormData(prev => ({ ...prev, department: val }));
                        else setEditFormData(prev => ({ ...prev, department: '' }));
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.department ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
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
                        <input
                          type="text"
                          name="department"
                          value={editFormData.department}
                          onChange={handleEditChange}
                          placeholder="Enter custom department"
                          className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                    )}
                    {editErrors.department && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.department}</p>
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
                        if (editErrors.designation) {
                          setEditErrors(prev => { const u = {...prev}; delete u.designation; return u; });
                        }
                        if (val !== 'Other') setEditFormData(prev => ({ ...prev, designation: val }));
                        else setEditFormData(prev => ({ ...prev, designation: '' }));
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.designation ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <option value="">Select Designation</option>
                      {designationsList.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="Other">Other</option>
                    </select>
                    {designationSelect === 'Other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          name="designation"
                          value={editFormData.designation}
                          onChange={handleEditChange}
                          placeholder="Enter custom designation"
                          className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                    )}
                    {editErrors.designation && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.designation}</p>
                    )}
                  </div>

                  <div>
                    <QualificationMultiSelect
                      id="teacher-edit-qualifications"
                      selected={editFormData.qualifications || []}
                      onChange={(newQualifications) => {
                        if (editErrors.qualifications || editErrors.highestQualification) {
                          setEditErrors((prev) => {
                            const u = { ...prev };
                            delete u.qualifications;
                            delete u.highestQualification;
                            return u;
                          });
                        }
                        setEditFormData((prev) => ({
                          ...prev,
                          qualifications: newQualifications,
                          highestQualification: newQualifications.join(', ')
                        }));
                      }}
                      error={editErrors.qualifications || editErrors.highestQualification}
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
                        if (editErrors.specialization) {
                          setEditErrors(prev => { const u = {...prev}; delete u.specialization; return u; });
                        }
                        if (val !== 'Other') setEditFormData(prev => ({ ...prev, specialization: val }));
                        else setEditFormData(prev => ({ ...prev, specialization: '' }));
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.specialization ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <option value="">Select Specialization</option>
                      {specializationsList.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="Other">Other</option>
                    </select>
                    {specializationSelect === 'Other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          name="specialization"
                          value={editFormData.specialization}
                          onChange={handleEditChange}
                          placeholder="Enter custom specialization"
                          className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                    )}
                    {editErrors.specialization && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.specialization}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Years of Experience <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="yearsOfExperience"
                      value={editFormData.yearsOfExperience}
                      onChange={handleEditChange}
                      min="0"
                      max="60"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editErrors.yearsOfExperience ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                      placeholder="e.g. 5"
                    />
                    {editErrors.yearsOfExperience && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{editErrors.yearsOfExperience}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editLoading}
                  className="px-5 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors cursor-pointer border border-transparent dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 cursor-pointer disabled:opacity-70 transition-colors shadow-sm"
                >
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Dependency Resolution */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={() => confirmDelete('delete')}
        title={teacherDependencies?.hasDependencies ? "Resolve Dependencies & Delete" : "Delete Permanently?"}
        recordName={teacherToDelete ? `${teacherToDelete.user?.name || teacherToDelete.personalInfo?.name || 'Teacher'} (${teacherToDelete.teacherId})` : ''}
        message={
          teacherDependencies?.hasDependencies
            ? "This faculty member has active teaching assignments. Review the courses below and select how to resolve them before completing deletion."
            : "Are you sure you want to permanently delete this record? This action cannot be undone."
        }
        loading={deleting}
        error={deleteError}
        confirmText={
          teacherDependencies?.hasDependencies
            ? (resolutionMode === 'reassign' ? 'Reassign & Delete' : 'Unassign & Delete')
            : 'Permanently Delete'
        }
        maxWidth={teacherDependencies?.hasDependencies ? 'max-w-lg' : 'max-w-md'}
        secondaryAction={
          teacherDependencies?.recordedGradesCount > 0 || (teacherDependencies?.hasDependencies && teacherToDelete?.user?.isActive !== false)
            ? {
                label: 'Deactivate Account Instead',
                onClick: () => confirmDelete('deactivate'),
                disabled: deleting,
                loading: deleting
              }
            : null
        }
      >
        {loadingDependencies && (
          <div className="w-full mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Checking teaching assignments and dependencies...</span>
          </div>
        )}

        {!loadingDependencies && teacherDependencies?.hasDependencies && (
          <div className="w-full mt-4 text-left space-y-3.5">
            {/* Warning banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold block">Active Teaching Assignments ({teacherDependencies.assignmentCount})</span>
                This faculty member is assigned to the courses below. Select how you want to resolve these courses to proceed with deletion:
              </div>
            </div>

            {/* List of active assignments */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              {teacherDependencies.assignments.map((a, idx) => (
                <div key={a._id || idx} className="text-xs p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>{a.subjectName}</span>
                    {a.subjectCode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-mono text-slate-600 dark:text-slate-300">
                        {a.subjectCode}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                    <span>{a.className || `${a.course || ''} ${a.department || ''} - Sem ${a.semester || ''} Sec ${a.section || ''}`}</span>
                    {a.academicYear && <span>• Calendar {a.academicYear}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Resolution Options */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Assignment Resolution:
              </label>

              {/* Option 1: Unassign */}
              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                resolutionMode === 'unassign'
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}>
                <input
                  type="radio"
                  name="resolutionMode"
                  value="unassign"
                  checked={resolutionMode === 'unassign'}
                  onChange={() => setResolutionMode('unassign')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">Unassign Teacher from Courses</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight block mt-0.5">
                    Courses remain intact in the section's curriculum as unassigned, allowing another faculty member to be assigned later.
                  </span>
                </div>
              </label>

              {/* Option 2: Reassign */}
              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                resolutionMode === 'reassign'
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}>
                <input
                  type="radio"
                  name="resolutionMode"
                  value="reassign"
                  checked={resolutionMode === 'reassign'}
                  onChange={() => setResolutionMode('reassign')}
                  disabled={!teacherDependencies.eligibleReassignTeachers || teacherDependencies.eligibleReassignTeachers.length === 0}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs flex-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">Reassign to Another Faculty Member</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight block mt-0.5 mb-2">
                    Automatically transfers these teaching assignments to another active instructor.
                  </span>

                  {resolutionMode === 'reassign' && (
                    <select
                      value={selectedReassignTeacherId}
                      onChange={(e) => setSelectedReassignTeacherId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {teacherDependencies.eligibleReassignTeachers.map(tch => (
                        <option key={tch._id} value={tch._id}>
                          {tch.name} ({tch.teacherId} • {tch.department})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            </div>

            {/* Note on Recorded Grades if any */}
            {teacherDependencies.recordedGradesCount > 0 && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold block">Historical Academic Records Detected</span>
                This teacher has recorded {teacherDependencies.recordedGradesCount} student grade records. To preserve historical student transcripts, you can choose <strong>"Deactivate Account Instead"</strong> below.
              </div>
            )}
          </div>
        )}
      </DeleteConfirmationModal>
    </div>
  );
}
