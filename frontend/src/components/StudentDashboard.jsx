import React, { useState, useEffect } from 'react';
import { studentApi } from '../api';
import { useTheme } from '../context/ThemeContext';
import ChangePasswordForm from './ChangePasswordForm';
import ClassPulseLogo from './ClassPulseLogo';
import {
  GraduationCap,
  BookOpen,
  User,
  Users,
  Mail,
  Phone,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  Sun,
  Moon,
  Loader2,
  RefreshCw,
  Award,
  FileText
} from 'lucide-react';

export default function StudentDashboard({ user, onPasswordChanged, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await studentApi.getDashboard();
      if (res.success) {
        setData(res);
      } else {
        setError('Failed to load dashboard information.');
      }
    } catch (err) {
      console.error('Student dashboard error:', err);
      setError(err.response?.data?.error || 'Failed to connect to student portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (showPasswordForm || user?.mustChangePassword) {
    return (
      <ChangePasswordForm
        user={user}
        onPasswordChanged={(updated) => {
          setShowPasswordForm(false);
          onPasswordChanged(updated);
        }}
        onLogout={onLogout}
      />
    );
  }

  const student = data?.student;
  const assignments = data?.assignments || [];
  const assignmentsPending = data?.assignmentsPending;
  const academicRecords = data?.academicRecords || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClassPulseLogo size="md" className="shrink-0" />
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                ClassPulse
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {data?.institution?.name || 'Student Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              type="button"
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2 text-xs font-medium"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <button
              onClick={() => setShowPasswordForm(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Change Password"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Password</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 dark:text-slate-400">
            <ClassPulseLogo size="xl" animated={true} className="mb-4" />
            <p className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-300">Loading your student dashboard...</p>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 p-8 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Portal Unavailable</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{error}</p>
            <button
              onClick={fetchDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <>
            {/* Student Welcome Banner */}
            <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-xs text-indigo-200 border border-white/10">
                      ID: {student?.studentId}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                      Active Student
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Welcome back, {student?.name || student?.studentId}!
                  </h2>
                  <p className="text-indigo-200 text-sm mt-1 max-w-xl">
                    {student?.course} in {student?.department} • Semester {student?.semester}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-start md:self-auto">
                  <button
                    onClick={fetchDashboard}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer border border-white/10"
                    title="Refresh curriculum"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Curriculum</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Academic Group Information Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs transition-colors">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      My Academic Group
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Automatically identified and assigned upon enrollment
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Auto-Grouped</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Program / Course
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {student?.course || '—'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Department
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block" title={student?.department}>
                    {student?.department || '—'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Academic Year
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {student?.academicYear || '—'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Semester
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Semester {student?.semester || '—'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Section
                  </span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    Section {student?.section || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inherited Subjects & Teachers Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      My Group Curriculum & Teachers
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Subjects and faculty inherited automatically from group membership
                    </p>
                  </div>
                </div>

                {assignmentsPending ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Assignments Pending</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{assignments.length} Subjects Active</span>
                  </span>
                )}
              </div>

              {assignmentsPending || assignments.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Group Curriculum Assignments Pending
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Your group is successfully initialized ({student?.course} - {student?.department}, Section {student?.section}), but subjects and faculty assignments are currently pending setup by the college administration.
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                    Once the administrator configures the group's subjects, they will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignments.map((asgn, idx) => {
                    const subj = asgn.subject || {};
                    const teacher = asgn.teacher || {};
                    const tName = teacher.user?.name || teacher.personalInfo?.name || teacher.teacherId || 'Assigned Faculty';
                    const tEmail = teacher.user?.email || teacher.personalInfo?.email;

                    return (
                      <div
                        key={asgn._id || idx}
                        className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors shadow-2xs"
                      >
                        <div>
                          {/* Subject Header */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                              {subj.code || 'CODE'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {subj.credits !== undefined && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {subj.credits} Credits
                                </span>
                              )}
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {subj.subjectType || 'Theory'}
                              </span>
                            </div>
                          </div>

                          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1" title={subj.name}>
                            {subj.name || 'Subject Name'}
                          </h4>
                          {subj.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                              {subj.description}
                            </p>
                          )}
                        </div>

                        {/* Teacher Card */}
                        <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={tName}>
                                {tName}
                              </span>
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {teacher.designation || 'Faculty'} • {teacher.department || student?.department}
                              </span>
                            </div>
                          </div>

                          {tEmail && (
                            <a
                              href={`mailto:${tEmail}`}
                              className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                              title={`Email ${tName}`}
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Academic Records / Historical Data Preservation Section */}
            {academicRecords.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs transition-colors">
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Preserved Academic History
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Historical marks and attendance records remain preserved across group updates
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold">Academic Year</th>
                        <th className="px-4 py-3 font-semibold">Marks</th>
                        <th className="px-4 py-3 font-semibold">Percentage</th>
                        <th className="px-4 py-3 font-semibold">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {academicRecords.map((rec) => {
                        const pct = rec.totalMarks > 0 ? Math.round((rec.marksObtained / rec.totalMarks) * 100) : 0;
                        return (
                          <tr key={rec._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                              {rec.subject?.code} - {rec.subject?.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                              {rec.academicYear?.year || '—'}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                              {rec.marksObtained} / {rec.totalMarks}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                                pct >= 75
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : pct >= 50
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              }`}>
                                {pct}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                              {rec.attendancePercentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        &copy; 2026 ClassPulse. Academic grouping and curriculum inheritance system.
      </footer>
    </div>
  );
}
