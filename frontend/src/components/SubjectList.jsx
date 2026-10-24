import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { Loader2, Search, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

export default function SubjectList() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [academicYears, setAcademicYears] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  
  const [departmentSelect, setDepartmentSelect] = useState('');
  const [subjectTypeSelect, setSubjectTypeSelect] = useState('Theory');
  
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    code: '',
    department: '',
    description: '',
    subjectType: 'Theory',
    credits: '',
    semester: '',
    academicYear: '',
    isActive: true
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError('');
    try {
      const deptRes = await adminApi.getDepartments();
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments in SubjectList:', err);
      setDeptError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      fetchDepartments();
      const [subjRes, yearsRes] = await Promise.all([
        adminApi.getSubjects(),
        adminApi.getAcademicYears()
      ]);
      
      if (subjRes.success) setSubjects(subjRes.subjects);
      
      if (yearsRes.success) {
        setAcademicYears(yearsRes.years);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Sync selected department in modal if departments finish loading after modal opens
  useEffect(() => {
    if (showModal && isEditing && editingSubject && departments.length > 0) {
      const deptVal = editingSubject.department || '';
      const deptRefId = editingSubject.departmentRef ? (editingSubject.departmentRef._id || editingSubject.departmentRef) : null;
      const matched = departments.find(d =>
        (d._id && String(d._id) === String(deptVal)) ||
        (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
        (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
        (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
      );
      if (matched && departmentSelect !== matched._id) {
        setDepartmentSelect(matched._id);
        setFormData(prev => ({ ...prev, department: matched._id }));
      }
    }
  }, [departments, showModal, isEditing, editingSubject]);

  const resolveDeptName = (s) => {
    if (s.departmentRef && s.departmentRef.name) return s.departmentRef.name;
    if (!s.department) return '—';
    const matched = departments.find(d =>
      (d._id && String(d._id) === String(s.department)) ||
      (d.code && d.code.toLowerCase() === String(s.department).toLowerCase()) ||
      (d.name && d.name.toLowerCase() === String(s.department).toLowerCase())
    );
    return matched ? matched.name : s.department;
  };

  const handleOpenCreate = () => {
    setFormData({
      _id: '', name: '', code: '', department: '', description: '',
      subjectType: 'Theory', credits: '', semester: '', academicYear: '', isActive: true
    });
    setDepartmentSelect('');
    setSubjectTypeSelect('Theory');
    setFormError('');
    setIsEditing(false);
    setEditingSubject(null);
    setShowModal(true);
  };

  const handleOpenEdit = (subject) => {
    setEditingSubject(subject);
    const deptVal = subject.department || '';
    const deptRefId = subject.departmentRef ? (subject.departmentRef._id || subject.departmentRef) : null;
    const matchedDept = departments.find(d =>
      (d._id && String(d._id) === String(deptVal)) ||
      (deptRefId && d._id && String(d._id) === String(deptRefId)) ||
      (d.name && d.name.toLowerCase() === String(deptVal).toLowerCase()) ||
      (d.code && d.code.toLowerCase() === String(deptVal).toLowerCase())
    );
    const initialDeptId = matchedDept ? matchedDept._id : (deptVal ? 'Other' : '');
    setDepartmentSelect(initialDeptId);
    
    const knownTypes = ['Theory', 'Practical', 'Both'];
    const typeVal = subject.subjectType || 'Theory';
    setSubjectTypeSelect(knownTypes.includes(typeVal) ? typeVal : 'Other');

    setFormData({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
      department: matchedDept ? matchedDept._id : deptVal,
      description: subject.description || '',
      subjectType: typeVal,
      credits: subject.credits || '',
      semester: subject.semester || '',
      academicYear: subject.academicYear || '',
      isActive: subject.isActive
    });
    setFormError('');
    setIsEditing(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!formData.name.trim() || !formData.code.trim() || !formData.department) {
      return setFormError('Name, Code, and Department are required.');
    }
    
    setSaving(true);
    try {
      if (isEditing) {
        await adminApi.updateSubject(formData._id, formData);
      } else {
        await adminApi.createSubject(formData);
      }
      setShowModal(false);
      fetchInitialData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (subject) => {
    if (!window.confirm(`Are you sure you want to ${subject.isActive ? 'deactivate' : 'activate'} this subject?`)) return;
    try {
      await adminApi.updateSubjectStatus(subject._id, !subject.isActive);
      fetchInitialData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const openDeleteModal = (subject) => {
    setSubjectToDelete(subject);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setSubjectToDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!subjectToDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await adminApi.deleteSubject(subjectToDelete._id);
      if (res.success) {
        setActionSuccess(`Subject "${subjectToDelete.name} (${subjectToDelete.code})" was permanently deleted.`);
        closeDeleteModal();
        fetchInitialData();
        setTimeout(() => setActionSuccess(''), 5000);
      } else {
        setDeleteError(res.error || 'Failed to delete subject');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete subject');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartment ?
      (s.department === filterDepartment ||
       (s.departmentRef && String(s.departmentRef._id || s.departmentRef) === String(filterDepartment)) ||
       (resolveDeptName(s).toLowerCase() === String(filterDepartment).toLowerCase()))
      : true;
    return matchesSearch && matchesDept;
  });

  const totalSubjects = subjects.length;
  const activeSubjects = subjects.filter(s => s.isActive).length;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error) return <div className="text-rose-600 bg-rose-50 p-4 rounded-lg">{error}</div>;

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors duration-200">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Subjects</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalSubjects}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors duration-200">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Active Subjects</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeSubjects}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors duration-200">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Inactive Subjects</p>
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{totalSubjects - activeSubjects}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col flex-1 overflow-hidden transition-colors duration-200">
        {actionSuccess && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-end items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">All Departments</option>
              {departments
                .filter(d => d && (d.name || d._id))
                .map(d => (
                  <option key={d._id || d.name} value={d.name || d._id}>
                    {d.name || d.code}
                  </option>
                ))}
            </select>
            <div className="relative flex-1 sm:w-64">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button onClick={handleOpenCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap cursor-pointer">
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Type / Credits</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-indigo-900 dark:text-indigo-300">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{resolveDeptName(s)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {s.subjectType} {s.credits ? `(${s.credits} CR)` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.isActive ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex justify-end items-center gap-3">
                    <button onClick={() => handleOpenEdit(s)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium cursor-pointer">
                      Edit
                    </button>
                    <button onClick={() => toggleStatus(s)} className={`text-sm font-medium cursor-pointer ${s.isActive ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' : 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300'}`}>
                      {s.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openDeleteModal(s)}
                      className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                      title="Permanently Delete Subject"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No subjects found. <button onClick={handleOpenCreate} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">Add one now</button>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{isEditing ? 'Edit Subject' : 'Add Subject'}</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              {formError && (
                <div className="mb-6 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-lg text-sm border border-rose-200 dark:border-rose-900/50">
                  {formError}
                </div>
              )}

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Name *</label>
                    <input
                      type="text" required
                      value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                      placeholder="e.g. Data Structures"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Code *</label>
                    <input
                      type="text" required
                      value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow uppercase"
                      placeholder="e.g. CS201"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                      required={departmentSelect !== 'Other'} 
                      value={departmentSelect} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setDepartmentSelect(val);
                        if (val !== 'Other') setFormData({...formData, department: val});
                        else setFormData({...formData, department: ''});
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Please specify *</label>
                        <input
                          type="text" required
                          value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Enter custom department"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Type</label>
                    <select
                      value={subjectTypeSelect} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjectTypeSelect(val);
                        if (val !== 'Other') setFormData({...formData, subjectType: val});
                        else setFormData({...formData, subjectType: ''});
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Theory">Theory</option>
                      <option value="Practical">Practical</option>
                      <option value="Both">Both</option>
                      <option value="Other">Other</option>
                    </select>
                    {subjectTypeSelect === 'Other' && (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Please specify *</label>
                        <input
                          type="text" required
                          value={formData.subjectType} onChange={(e) => setFormData({...formData, subjectType: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Enter custom subject type"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Credits</label>
                    <input
                      type="number" min="0" step="0.5"
                      value={formData.credits} onChange={(e) => setFormData({...formData, credits: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                    <input
                      type="text"
                      value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 3rd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Academic Year</label>
                    <select
                      value={formData.academicYear} onChange={(e) => setFormData({...formData, academicYear: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">None</option>
                      {academicYears.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Brief description of the subject..."
                  />
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px] cursor-pointer">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
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
        recordName={subjectToDelete ? `${subjectToDelete.name} (${subjectToDelete.code})` : ''}
        message="Are you sure you want to permanently delete this record? This action cannot be undone."
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
