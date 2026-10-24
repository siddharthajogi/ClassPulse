import axios from 'axios';

// Create configured Axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const authApi = {
  login: async (userId, password, role) => {
    const response = await api.post('/auth/login', { userId, password, role });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword
    });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  }
};

export const adminApi = {
  getDashboardStats: async () => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  },
  getActiveAccounts: async () => {
    const response = await api.get('/admin/accounts');
    return response.data;
  },
  getStudents: async () => {
    const response = await api.get('/admin/students');
    return response.data;
  },
  getStudentById: async (id) => {
    const response = await api.get(`/admin/students/${id}`);
    return response.data;
  },
  createStudent: async (studentData) => {
    const response = await api.post('/admin/students', studentData);
    return response.data;
  },
  updateStudent: async (id, studentData) => {
    const response = await api.put(`/admin/students/${id}`, studentData);
    return response.data;
  },
  deleteStudent: async (id) => {
    const response = await api.delete(`/admin/students/${id}`);
    return response.data;
  },
  getClasses: async () => {
    const response = await api.get('/admin/classes');
    return response.data;
  },
  getClassById: async (id) => {
    const response = await api.get(`/admin/classes/${id}`);
    return response.data;
  },
  createClass: async (classData) => {
    const response = await api.post('/admin/classes', classData);
    return response.data;
  },
  updateClass: async (id, classData) => {
    const response = await api.put(`/admin/classes/${id}`, classData);
    return response.data;
  },
  updateDepartmentBatch: async (data) => {
    const response = await api.put('/admin/departments/batch-update', data);
    return response.data;
  },
  deleteClass: async (id, params = {}) => {
    const response = await api.delete(`/admin/classes/${id}`, { params, data: params });
    return response.data;
  },
  deleteDepartment: async (name, params = {}) => {
    const response = await api.delete(`/admin/departments/${encodeURIComponent(name)}`, { params });
    return response.data;
  },
  reconcileStudentGroups: async () => {
    const response = await api.post('/admin/classes/reconcile-students');
    return response.data;
  },
  updateClassAssignments: async (id, assignments) => {
    const response = await api.put(`/admin/classes/${id}/assignments`, { assignments });
    return response.data;
  },
  getDepartments: async () => {
    const response = await api.get('/admin/departments');
    return response.data;
  },
  getSubjects: async () => {
    const response = await api.get('/admin/subjects');
    return response.data;
  },
  createSubject: async (subjectData) => {
    const response = await api.post('/admin/subjects', subjectData);
    return response.data;
  },
  updateSubject: async (id, subjectData) => {
    const response = await api.put(`/admin/subjects/${id}`, subjectData);
    return response.data;
  },
  updateSubjectStatus: async (id, isActive) => {
    const response = await api.patch(`/admin/subjects/${id}/status`, { isActive });
    return response.data;
  },
  deleteSubject: async (id) => {
    const response = await api.delete(`/admin/subjects/${id}`);
    return response.data;
  },
  getTeachers: async () => {
    const response = await api.get('/admin/teachers');
    return response.data;
  },
  getTeacherById: async (id) => {
    const response = await api.get(`/admin/teachers/${id}`);
    return response.data;
  },
  createTeacher: async (teacherData) => {
    const response = await api.post('/admin/teachers', teacherData);
    return response.data;
  },
  updateTeacher: async (id, teacherData) => {
    const response = await api.put(`/admin/teachers/${id}`, teacherData);
    return response.data;
  },
  getTeacherDependencies: async (id) => {
    const response = await api.get(`/admin/teachers/${id}/dependencies`);
    return response.data;
  },
  deleteTeacher: async (id, options = {}) => {
    const response = await api.delete(`/admin/teachers/${id}`, { data: options });
    return response.data;
  },
  updateUserStatus: async (id, isActive) => {
    const response = await api.patch(`/admin/users/${id}/status`, { isActive });
    return response.data;
  },
  resetUserPassword: async (id, newPassword) => {
    const response = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
  },
  getInstitutionSetupStatus: async () => {
    const response = await api.get('/admin/institution/status');
    return response.data;
  },
  setupInstitution: async (data) => {
    const response = await api.post('/admin/institution/setup', data);
    return response.data;
  },
  updateInstitutionSettings: async (data) => {
    const response = await api.put('/admin/institution/settings', data);
    return response.data;
  },
  uploadInstitutionLogo: async (formData) => {
    const response = await api.post('/admin/institution/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
  getPreferences: async () => {
    const response = await api.get('/admin/preferences');
    return response.data;
  },
  updatePreferences: async (preferences) => {
    const response = await api.put('/admin/preferences', preferences);
    return response.data;
  },
  getAcademicYears: async () => {
    const response = await api.get('/admin/academic-years');
    return response.data;
  },
  deleteAcademicYear: async (id) => {
    const response = await api.delete(`/admin/academic-years/${id}`);
    return response.data;
  },
  getEnrollmentAnalytics: async () => {
    const response = await api.get('/admin/dashboard/enrollment-analytics');
    return response.data;
  },
  getPerformanceAnalytics: async () => {
    const response = await api.get('/admin/dashboard/performance-analytics');
    return response.data;
  },
  getRiskOverview: async () => {
    const response = await api.get('/admin/dashboard/risk-overview');
    return response.data;
  },
  getRecentActivity: async () => {
    const response = await api.get('/admin/dashboard/recent-activity');
    return response.data;
  },
  getNotifications: async (params = {}) => {
    const response = await api.get('/admin/notifications', { params });
    return response.data;
  },
  getUnreadNotificationCount: async () => {
    const response = await api.get('/admin/notifications/unread-count');
    return response.data;
  },
  markNotificationAsRead: async (id) => {
    const response = await api.patch(`/admin/notifications/${id}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.patch('/admin/notifications/mark-all-read');
    return response.data;
  },
  deleteNotification: async (id) => {
    const response = await api.delete(`/admin/notifications/${id}`);
    return response.data;
  },
  bulkMarkNotificationsAsRead: async (ids) => {
    const response = await api.patch('/admin/notifications/bulk-read', { ids });
    return response.data;
  },
  bulkDeleteNotifications: async (ids) => {
    const response = await api.post('/admin/notifications/bulk-delete', { ids });
    return response.data;
  },
  getDepartments: async () => {
    const response = await api.get('/admin/departments');
    return response.data;
  },
  getAdminProfile: async () => {
    const response = await api.get('/admin/profile');
    return response.data;
  },
  updateAdminProfile: async (profileData) => {
    const response = await api.put('/admin/profile', profileData);
    return response.data;
  }
};

export const studentApi = {
  getDashboard: async () => {
    const response = await api.get('/student/dashboard');
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/student/profile');
    return response.data;
  },
  updateProfile: async (profileData) => {
    const response = await api.put('/student/profile', profileData);
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/student/notifications');
    return response.data;
  },
  markNotificationAsRead: async (id) => {
    const response = await api.patch(`/student/notifications/${id}/read`);
    return response.data;
  },
  markAllNotificationsAsRead: async () => {
    const response = await api.patch('/student/notifications/mark-all-read');
    return response.data;
  }
};

export const teacherApi = {
  getDashboardAnalytics: async () => {
    const response = await api.get('/teacher/dashboard/analytics');
    return response.data;
  },
  getDashboardStats: async () => {
    const response = await api.get('/teacher/dashboard/stats');
    return response.data;
  },
  getMySubjects: async () => {
    const response = await api.get('/teacher/subjects');
    return response.data;
  },
  getMyClasses: async () => {
    const response = await api.get('/teacher/classes');
    return response.data;
  },
  getClassById: async (id) => {
    const response = await api.get(`/teacher/classes/${id}`);
    return response.data;
  },
  getSectionStudents: async (id) => {
    const response = await api.get(`/teacher/classes/${id}`);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/teacher/profile');
    return response.data;
  },
  getTeacherProfile: async () => {
    const response = await api.get('/teacher/profile');
    return response.data;
  },
  updateProfile: async (profileData) => {
    const response = await api.put('/teacher/profile', profileData);
    return response.data;
  },
  updateTeacherProfile: async (profileData) => {
    const response = await api.put('/teacher/profile', profileData);
    return response.data;
  }
};

export default api;

