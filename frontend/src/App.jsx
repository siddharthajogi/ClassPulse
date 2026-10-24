import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  Loader2, 
  Sun, 
  Moon, 
  BookOpen, 
  Layers, 
  Users, 
  Activity, 
  Target, 
  Sparkles, 
  CheckSquare, 
  FileText, 
  CalendarCheck, 
  BookOpenCheck, 
  TrendingUp 
} from 'lucide-react';
import ClassPulseLogo from './components/ClassPulseLogo';
import LoginCard from './components/LoginCard';
import ChangePasswordForm from './components/ChangePasswordForm';
import StudentTeacherAccount from './components/StudentTeacherAccount';
import AdminLayout from './components/AdminLayout';
import DashboardStats from './components/DashboardStats';
import StudentList from './components/StudentList';
import StudentCreate from './components/StudentCreate';
import StudentProfile from './components/StudentProfile';
import TeacherList from './components/TeacherList';
import TeacherCreate from './components/TeacherCreate';
import TeacherProfile from './components/TeacherProfile';
import CollegeSettings from './components/CollegeSettings';
import GeneralSettings from './components/GeneralSettings';
import SubjectList from './components/SubjectList';
import ClassesSections from './components/ClassesSections';
import StudentDashboard from './components/StudentDashboard';
import ActiveAccountsList from './components/ActiveAccountsList';
import Notifications from './components/Notifications';
import AdminProfile from './components/AdminProfile';
import Placeholder from './components/Placeholder';
import TeacherLayout from './components/TeacherLayout';
import TeacherDashboardOverview from './components/TeacherDashboardOverview';
import TeacherMySubjects from './components/TeacherMySubjects';
import TeacherClassesSections from './components/TeacherClassesSections';
import TeacherSectionDetails from './components/TeacherSectionDetails';
import TeacherPlaceholder from './components/TeacherPlaceholder';
import TeacherProfilePage from './components/TeacherProfilePage';
import TeacherNotifications from './components/TeacherNotifications';
import { authApi } from './api';
import { useTheme } from './context/ThemeContext';

function ProtectedRoute({ currentUser, allowedRoles, children }) {
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace state={{ unauthorized: true }} />;
  }

  return children;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await authApi.getMe();
        if (data && data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (_) {
        setCurrentUser(null);
      } finally {
        setCheckingSession(false);
      }
    };
    restoreSession();
  }, []);

  const handleLoginSuccess = async (credentials) => {
    const res = await authApi.login(credentials.userId, credentials.password, credentials.role);
    if (res && res.success && res.user) {
      setCurrentUser(res.user);
      if (res.user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (res.user.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true });
      } else if (res.user.role === 'student') {
        navigate('/student/dashboard', { replace: true });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setCurrentUser(null);
      navigate('/', { replace: true });
    }
  };

  const handlePasswordChanged = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-500 dark:text-slate-400">
        <div className="relative mb-4 flex items-center justify-center">
          <ClassPulseLogo size="xl" animated={true} />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-300">Loading ClassPulse...</p>
      </div>
    );
  }

  // Mandatory Password Change Intercept
  if (currentUser && currentUser.mustChangePassword) {
    return (
      <ChangePasswordForm
        user={currentUser}
        onPasswordChanged={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  const isUnauthorized = Boolean(location.state?.unauthorized);
  const showLogin = !currentUser || isUnauthorized;

  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/" element={
        showLogin ? (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative transition-colors duration-200">
            {/* Quick Appearance Toggle on Login Page */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
              <button
                onClick={toggleTheme}
                type="button"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2 text-xs font-medium"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center py-8">
              <div className="text-center mb-10 sm:mb-12">
                <div className="inline-flex items-center justify-center mb-4">
                  <ClassPulseLogo size="2xl" className="hover:scale-105 transition-transform duration-300 drop-shadow-xs" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  ClassPulse
                </h1>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto font-normal">
                  Your Journey to Knowledge and Success.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                <LoginCard role="student" onLoginSuccess={handleLoginSuccess} />
                <LoginCard role="teacher" onLoginSuccess={handleLoginSuccess} />
                <LoginCard role="admin" onLoginSuccess={handleLoginSuccess} />
              </div>
            </main>
            <footer className="text-center py-6 border-t border-slate-200 dark:border-slate-800 mt-10 text-xs text-slate-500 dark:text-slate-400">
              &copy; 2026 ClassPulse. All rights reserved.
            </footer>
          </div>
        ) : (
          <Navigate to={currentUser.role === 'admin' ? '/admin/dashboard' : `/${currentUser.role}/dashboard`} replace />
        )
      } />

      {/* Student Protected Routes */}
      <Route path="/student/*" element={
        <ProtectedRoute currentUser={currentUser} allowedRoles={['student']}>
          <StudentDashboard user={currentUser} onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />
        </ProtectedRoute>
      } />

      {/* Teacher Protected Routes */}
      <Route path="/teacher" element={
        <ProtectedRoute currentUser={currentUser} allowedRoles={['teacher']}>
          <TeacherLayout onLogout={handleLogout} currentUser={currentUser} />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboardOverview currentUser={currentUser} />} />
        <Route path="subjects" element={<TeacherMySubjects currentUser={currentUser} />} />
        <Route
          path="classes"
          element={<TeacherClassesSections currentUser={currentUser} />}
        />
        <Route
          path="classes/:classId"
          element={<TeacherSectionDetails currentUser={currentUser} />}
        />
        <Route
          path="students"
          element={
            <TeacherPlaceholder
              title="Students"
              icon={Users}
              description="Directory of enrolled students across your assigned sections with individual profiles."
            />
          }
        />
        <Route
          path="risk-analytics"
          element={
            <TeacherPlaceholder
              title="Student Risk Analytics"
              icon={Activity}
              description="AI-driven early risk radar, attendance alerts, and academic drop-off predictors."
            />
          }
        />
        <Route
          path="knowledge-gaps"
          element={
            <TeacherPlaceholder
              title="Knowledge-Gap Analysis"
              icon={Target}
              description="Topic-level concept diagnosis, prerequisite assessment, and remediation heatmaps."
            />
          }
        />
        <Route
          path="personalized-learning"
          element={
            <TeacherPlaceholder
              title="Personalized Learning"
              icon={Sparkles}
              description="Tailored practice sets, adaptive study recommendations, and targeted interventions."
            />
          }
        />
        <Route
          path="intervention-review"
          element={
            <TeacherPlaceholder
              title="Intervention Review"
              icon={CheckSquare}
              description="Approve and monitor teacher interventions, tutoring plans, and student recovery checkpoints."
            />
          }
        />
        <Route
          path="academic-records"
          element={
            <TeacherPlaceholder
              title="Academic Records"
              icon={FileText}
              description="Tabulate internal marks, continuous evaluations, laboratory tests, and semester grades."
            />
          }
        />
        <Route
          path="attendance"
          element={
            <TeacherPlaceholder
              title="Attendance"
              icon={CalendarCheck}
              description="Daily session roll call, biometric sync, excused leaves, and aggregate attendance registers."
            />
          }
        />
        <Route
          path="assignments"
          element={
            <TeacherPlaceholder
              title="Assignments"
              icon={BookOpenCheck}
              description="Distribute, collect, evaluate, and provide feedback on coursework and homework."
            />
          }
        />
        <Route
          path="learning-improvement"
          element={
            <TeacherPlaceholder
              title="Learning Improvement"
              icon={TrendingUp}
              description="Track cohort progress trajectories, intervention effectiveness, and learning outcomes."
            />
          }
        />
        <Route
          path="profile"
          element={
            <TeacherProfilePage
              currentUser={currentUser}
              onPasswordChanged={handlePasswordChanged}
              onLogout={handleLogout}
            />
          }
        />
        <Route
          path="notifications"
          element={<TeacherNotifications currentUser={currentUser} />}
        />
      </Route>

      {/* Admin Protected Routes */}
      <Route path="/admin" element={
        <ProtectedRoute currentUser={currentUser} allowedRoles={['admin']}>
          <AdminLayout onLogout={handleLogout} currentUser={currentUser} />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardStats />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="accounts" element={<ActiveAccountsList />} />
        <Route path="active-accounts" element={<ActiveAccountsList />} />
        <Route path="students" element={<StudentList />} />
        <Route path="students/create" element={<StudentCreate />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="teachers" element={<TeacherList />} />
        <Route path="teachers/create" element={<TeacherCreate />} />
        <Route path="teachers/:id" element={<TeacherProfile />} />
        <Route path="classes" element={<ClassesSections />} />
        <Route path="subjects" element={<SubjectList />} />
        <Route path="assignments" element={<ClassesSections />} />
        <Route path="academic-records" element={<Placeholder title="Academic Records" />} />
        <Route path="risk-analytics" element={<Placeholder title="Risk Analytics Overview" />} />
        <Route path="reports" element={<Placeholder title="Reports & Exports" />} />
        <Route path="activity-logs" element={<Placeholder title="Audit Logs" />} />
        <Route path="settings" element={<GeneralSettings currentUser={currentUser} onLogout={handleLogout} />} />
        <Route path="college-settings" element={<CollegeSettings />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      {/* Fallback Catch-All */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
