import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi } from '../api';
import { Loader2, Search, MoreVertical, ShieldAlert, X, Trash2, CheckCircle2 } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

export default function StudentList() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [departmentSelect, setDepartmentSelect] = useState('');
  const [courseSelect, setCourseSelect] = useState('');
  const [semesterSelect, setSemesterSelect] = useState('');

  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');

  const coursesList = ['B.Tech', 'M.Tech', 'Ph.D.', 'B.Sc.', 'M.Sc.', 'BCA', 'MCA'];
  const semestersList = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  const [formData, setFormData] = useState({
    _id: '',
    studentId: '',
    course: '',
    department: '',
    academicYear: '',
    semester: '',
    section: '',
    personalInfo: { name: '', email: '' }
  });

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

  const fetchData = async () => {
    try {
      const [studentsRes, deptRes] = await Promise.all([
        adminApi.getStudents(),
        adminApi.getDepartments()
      ]);
      if (studentsRes.success) setStudents(studentsRes.students || []);
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      } else if (deptRes && !deptRes.success) {
        setDeptError(deptRes.error || 'Failed to load departments');
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openDeleteModal = (student) => {
    setStudentToDelete(student);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setStudentToDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      setDeleting(true);
      setDeleteError('');
      const res = await adminApi.deleteStudent(studentToDelete._id);
      if (res.success) {
        setActionSuccess(res.message || 'Student was permanently deleted.');
        setDeleteModalOpen(false);
        setStudentToDelete(null);
        await fetchData();
        setTimeout(() => setActionSuccess(''), 4000);
      } else {
        setDeleteError(res.error || 'Failed to delete student.');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete student.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (student) => {
    if (!window.confirm(`Are you sure you want to ${student.user.isActive ? 'deactivate' : 'activate'} this student?`)) return;
    try {
      await adminApi.updateUserStatus(student.user._id, !student.user.isActive);
      fetchData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const resetPassword = async (student) => {
    const newPassword = prompt(`Enter new temporary password for ${student.studentId} (Min 8 chars, 1 letter, 1 number/symbol):`);
    if (!newPassword) return;
    try {
      await adminApi.resetUserPassword(student.user._id, newPassword);
      alert('Password reset successfully. User must change it on next login.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  // Sync department selection if departments load while Edit modal is already open
  useEffect(() => {
    if (showModal && departments.length > 0 && formData.department) {
      const currentVal = formData.department;
      if (currentVal && currentVal !== 'Other') {
        const matched = departments.find(d =>
          (d._id && String(d._id) === String(currentVal)) ||
          (d.name && d.name.toLowerCase().trim() === String(currentVal).toLowerCase().trim()) ||
          (d.code && d.code.toLowerCase().trim() === String(currentVal).toLowerCase().trim())
        );
        if (matched && departmentSelect !== matched._id) {
          setDepartmentSelect(matched._id);
          setFormData(prev => ({ ...prev, department: matched._id }));
        }
      }
    }
  }, [departments, showModal]);

  const handleEditClick = (student) => {
    if (departments.length === 0 && !loadingDepts) {
      fetchDepartments();
    }

    const studentDeptRaw = student.department || (student.classRef && student.classRef.department) || (student.departmentRef && student.departmentRef.name) || '';

    // Match saved department by _id, name, or code
    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(studentDeptRaw)) ||
      (d.name && d.name.toLowerCase().trim() === String(studentDeptRaw).toLowerCase().trim()) ||
      (d.code && d.code.toLowerCase().trim() === String(studentDeptRaw).toLowerCase().trim()) ||
      (student.departmentRef?._id && d._id && String(d._id) === String(student.departmentRef._id))
    );

    const initialDeptId = matchedDept ? matchedDept._id : (studentDeptRaw ? 'Other' : '');
    setDepartmentSelect(initialDeptId);
    
    const isCourseKnown = coursesList.includes(student.course);
    setCourseSelect(isCourseKnown ? student.course : (student.course ? 'Other' : ''));

    const isSemesterKnown = semestersList.includes(student.semester);
    setSemesterSelect(isSemesterKnown ? student.semester : (student.semester ? 'Other' : ''));

    setFormData({
      _id: student._id,
      studentId: student.studentId,
      course: student.course || '',
      department: matchedDept ? matchedDept._id : (studentDeptRaw || ''),
      academicYear: student.academicYear || '',
      semester: student.semester || '',
      section: student.section || '',
      personalInfo: {
        name: student.user?.name || '',
        email: student.personalInfo?.email || ''
      }
    });
    setFormError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await adminApi.updateStudent(formData._id, formData);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter(s => 
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Search students..."
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
              <th className="px-6 py-4 font-medium">Student ID</th>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium">Group / Section</th>
              <th className="px-6 py-4 font-medium">Year</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((s) => (
              <tr
                key={s._id}
                onClick={() => navigate(`/admin/students/${s._id}`)}
                className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                title="Click to view student profile"
              >
                <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <Link
                    to={`/admin/students/${s._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {s.studentId}
                  </Link>
                </td>
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                  <Link
                    to={`/admin/students/${s._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {s.user?.name || 'Name not available'}
                  </Link>
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                  {(() => {
                    const raw = s.department || s.departmentRef?.name || (s.classRef && s.classRef.department) || '—';
                    const found = departments.find(d => String(d._id) === String(raw) || d.code === raw);
                    return found ? found.name : raw;
                  })()}
                </td>
                <td className="px-6 py-4 text-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                    Sem {s.semester || '—'} • Sec {s.section || '—'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{s.academicYear}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${s.user?.isActive ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                    {s.user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td
                  className="px-6 py-4 text-right flex justify-end gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleEditClick(s)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(s)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    {s.user?.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => resetPassword(s)}
                    className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" /> Reset Pwd
                  </button>
                  <button
                    onClick={() => openDeleteModal(s)}
                    className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                    title="Permanently Delete Student"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No students found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Student</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              {formError && (
                <div className="mb-6 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-sm border border-rose-200 dark:border-rose-900/50">
                  {formError}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                      <input type="text" name="personalInfo.name" value={formData.personalInfo.name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                      <input type="email" name="personalInfo.email" value={formData.personalInfo.email} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Academic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Course</label>
                      <select value={courseSelect} onChange={(e) => {
                          const val = e.target.value;
                          setCourseSelect(val);
                          if (val !== 'Other') setFormData(prev => ({...prev, course: val}));
                          else setFormData(prev => ({...prev, course: ''}));
                        }} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Course</option>
                        {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {courseSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                          <input type="text" name="course" value={formData.course} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Enter custom course" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      {loadingDepts ? (
                        <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-sm">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                          <span>Loading departments...</span>
                        </div>
                      ) : deptError ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between p-2.5 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                            <span>{deptError}</span>
                            <button
                              type="button"
                              onClick={fetchDepartments}
                              className="underline font-semibold hover:text-rose-800 dark:hover:text-rose-200 ml-2 cursor-pointer"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          id="edit-student-department-select"
                          name="department"
                          value={departmentSelect}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDepartmentSelect(val);
                            if (val !== 'Other') setFormData(prev => ({ ...prev, department: val }));
                            else setFormData(prev => ({ ...prev, department: '' }));
                          }}
                          required
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Department</option>
                          {departments.length === 0 ? (
                            <option value="" disabled>No departments configured</option>
                          ) : (
                            departments.map(d => {
                              const optVal = d._id || d.code || d.name;
                              const optLabel = (d.name && d.name.trim()) || (d.code && d.code.trim()) || 'Unnamed Department';
                              return (
                                <option key={optVal} value={optVal}>
                                  {optLabel}
                                </option>
                              );
                            })
                          )}
                          <option value="Other">Other</option>
                        </select>
                      )}
                      {departmentSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                          <input
                            type="text"
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            required
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter custom department"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                      <select value={semesterSelect} onChange={(e) => {
                          const val = e.target.value;
                          setSemesterSelect(val);
                          if (val !== 'Other') setFormData(prev => ({...prev, semester: val}));
                          else setFormData(prev => ({...prev, semester: ''}));
                        }} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Semester</option>
                        {semestersList.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {semesterSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Please specify *</label>
                          <input type="text" name="semester" value={formData.semester} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Enter custom semester" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Academic Year</label>
                      <input type="text" name="academicYear" value={formData.academicYear} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Section</label>
                      <input type="text" name="section" value={formData.section} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Account Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student Login ID</label>
                      <input type="text" name="studentId" value={formData.studentId} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300" readOnly title="Student ID is read-only by default" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Student ID is used for login and cannot be easily changed.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors cursor-pointer border border-transparent dark:border-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px] cursor-pointer">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Permanently?"
        recordName={studentToDelete ? `${studentToDelete.user?.name || studentToDelete.personalInfo?.name || 'Student'} (${studentToDelete.studentId})` : ''}
        message="Are you sure you want to permanently delete this record? This action cannot be undone."
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
