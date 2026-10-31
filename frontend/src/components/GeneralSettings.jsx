import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  User, 
  KeyRound, 
  Bell, 
  Palette, 
  ShieldCheck, 
  Info, 
  ExternalLink, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Building, 
  Sun, 
  Moon,
  Lock,
  FileText,
  Sliders,
  Check
} from 'lucide-react';
import { authApi, adminApi } from '../api';
import { usePageRefresh } from '../context/RefreshContext';
import { useTheme } from '../context/ThemeContext';
import pkg from '../../package.json';

export default function GeneralSettings(props) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const outletContext = useOutletContext() || {};
  
  // Resolve current user and logout handler from props or outlet context
  const currentUser = props.currentUser || outletContext.currentUser;
  const onLogout = props.onLogout || outletContext.onLogout;

  // Account State
  const [adminUser, setAdminUser] = useState(currentUser || null);
  const [fetchingUser, setFetchingUser] = useState(!currentUser);

  // Notification Preferences State
  const [notifications, setNotifications] = useState({
    inApp: true,
    academicRecords: true,
    accountActivity: true,
    riskAlerts: true
  });
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');
  const [prefsError, setPrefsError] = useState('');

  // Password Change Modal / Accordion State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const loadData = useCallback(async () => {
    // 1. Fetch current user if not provided
    if (!currentUser) {
      try {
        const res = await authApi.getMe();
        if (res.success && res.user) {
          setAdminUser(res.user);
        }
      } catch (err) {
        console.error('Failed to fetch user in settings:', err);
      } finally {
        setFetchingUser(false);
      }
    } else {
      setAdminUser(currentUser);
      setFetchingUser(false);
    }

    // 2. Fetch saved notification preferences from backend
    try {
      setLoadingPrefs(true);
      const res = await adminApi.getPreferences();
      if (res.success && res.preferences?.notifications) {
        setNotifications(res.preferences.notifications);
      }
    } catch (err) {
      console.warn('Could not load preferences from backend:', err);
    } finally {
      setLoadingPrefs(false);
    }
  }, [currentUser]);

  usePageRefresh(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Notification Toggle
  const handleToggle = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setPrefsSuccess('');
    setPrefsError('');
  };

  // Save Preferences to Backend
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefsSuccess('');
    setPrefsError('');

    try {
      const res = await adminApi.updatePreferences({ notifications });
      if (res.success) {
        setPrefsSuccess('Notification preferences saved successfully to your account.');
        if (res.preferences?.notifications) {
          setNotifications(res.preferences.notifications);
        }
      } else {
        setPrefsError(res.error || 'Failed to save preferences.');
      }
    } catch (err) {
      setPrefsError(err.response?.data?.error || 'Failed to save notification preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Handle Password Change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPwError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9!@#$%^&*])/.test(newPassword)) {
      setPwError('New password must contain letters and at least one number or symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('New password cannot be the same as current password.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword, confirmPassword);
      if (res.success) {
        setPwSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPwSuccess('');
        }, 1500);
      }
    } catch (err) {
      setPwError(err.response?.data?.error || err.message || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
  };

  // Secure Logout
  const handleSecureLogout = async () => {
    if (onLogout) {
      await onLogout();
      navigate('/');
    } else {
      await authApi.logout();
      navigate('/');
    }
  };

  return (
    <div className="space-y-6 pb-16 transition-colors duration-200">
      {/* Header Row: Description on left, College Settings button on right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure your personal account preferences, notification rules, security policies, and application information.
        </p>

        {/* Link to College Settings */}
        <div className="shrink-0 flex items-center">
          <Link
            to="/admin/college-settings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors shadow-xs whitespace-nowrap"
            title="Open College & Institution Profile Settings"
          >
            <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>College Settings</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* =======================================================
            1. ACCOUNT PREFERENCES
        ======================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Account Preferences</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Authenticated administrator profile and credential options</p>
              </div>
            </div>

            {fetchingUser ? (
              <div className="py-6 flex items-center justify-center text-slate-400 gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading account details...</span>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-400 block font-medium">Full Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block truncate">
                      {adminUser?.name || 'Administrator'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-400 block font-medium">Login User ID</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block font-mono">
                      {adminUser?.userId || 'admin'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-400 block font-medium">Role</span>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md font-semibold text-[11px] uppercase tracking-wide bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                      {adminUser?.role || 'admin'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Password protection: <strong>Encrypted with Bcrypt</strong> (Never exposed)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <Link
              to="/admin/profile"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Open My Profile</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </Link>

            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPwError('');
                setPwSuccess('');
              }}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>
          </div>
        </div>

        {/* =======================================================
            2. APPEARANCE INFORMATION
        ======================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Appearance Information</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Global interface theme synchronization</p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Sun className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <Moon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      Active Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                      High-contrast, eye-friendly layout active across all pages.
                    </span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 uppercase tracking-wider text-[11px]">
                  {theme}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <p>
                  To change between Light and Dark modes, use the dedicated theme switcher in the <strong>navigation sidebar</strong> above Logout. General Settings automatically adheres to your selected theme.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            Appearance respects system preferences and persists across browser sessions.
          </div>
        </div>

        {/* =======================================================
            3. NOTIFICATION PREFERENCES
        ======================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 lg:col-span-2 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Notification Preferences</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configure which event categories trigger system alerts and updates</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                Persisted in MongoDB
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {prefsSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{prefsSuccess}</span>
            </div>
          )}

          {prefsError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{prefsError}</span>
            </div>
          )}

          {/* Notification feature status banner */}
          <div className="mb-6 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notification Service Status: Active & Operational</p>
                <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Your notification rules are persisted in MongoDB. In-app alerts, badge counters, and real-time triggers adhere to these configurations. Critical security alerts and system warnings remain delivered.
                </p>
              </div>
            </div>
            <Link
              to="/admin/notifications"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <span>View Notifications</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Toggles */}
          <form onSubmit={handleSavePreferences}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. In-App Notifications */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">In-App Notifications</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enable in-app banner alerts and badge counters within the admin portal.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.inApp}
                  onClick={() => handleToggle('inApp')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    notifications.inApp ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      notifications.inApp ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2. Academic & Assessment Records */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Academic & Assessment Records</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Receive updates when student exam grades, marks, or assessment batches are posted.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.academicRecords}
                  onClick={() => handleToggle('academicRecords')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    notifications.academicRecords ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      notifications.academicRecords ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Student & Teacher Accounts */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Account Management Alerts</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Alerts on new student registration, faculty onboarding, or account deactivations.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.accountActivity}
                  onClick={() => handleToggle('accountActivity')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    notifications.accountActivity ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      notifications.accountActivity ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 4. Student Risk Analytics */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risk Analytics Alerts</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    High-priority alerts when academic drop-off or low-attendance flags are calculated.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.riskAlerts}
                  onClick={() => handleToggle('riskAlerts')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    notifications.riskAlerts ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      notifications.riskAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingPrefs || loadingPrefs}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {savingPrefs ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Preferences...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Notification Preferences</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* =======================================================
            4. PRIVACY AND SECURITY
        ======================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Privacy & Security</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Session authentication and encryption safeguards</p>
              </div>
            </div>

            <div className="space-y-3 pt-1 text-xs text-slate-600 dark:text-slate-400">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Session State</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active Secure Session
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Cookie Protection</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">HTTP-Only / SameSite</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Password Hashing</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">Bcrypt Salted (10 rounds)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] leading-relaxed">
                Passwords and security tokens are cryptographically hashed and never stored or returned in plaintext. Administrators can audit access records in the activity logs.
              </div>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <Link
              to="/admin/activity-logs"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Audit Logs</span>
            </Link>

            <button
              onClick={handleSecureLogout}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* =======================================================
            5. APPLICATION INFORMATION
        ======================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Application Information</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">System deployment and platform identity</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Application Name</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">ClassPulse</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Platform Role</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Academic & Admin Portal</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Release Version</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {pkg?.version ? `v${pkg.version}` : 'v1.0.0'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                ClassPulse provides high-integrity student record keeping, hierarchical department administration, section-level subject assignment, and machine-learning driven academic risk analytics.
              </p>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Link to="/admin/college-settings" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              College Settings
            </Link>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <Link to="/admin/profile" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              My Profile
            </Link>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <Link to="/admin/activity-logs" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Audit Logs
            </Link>
          </div>
        </div>
      </div>

      {/* =======================================================
          CHANGE PASSWORD MODAL
      ======================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Change Password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update your administrator account password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
              >
                &times;
              </button>
            </div>

            {pwError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters with letters & numbers"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400 dark:text-slate-400 mt-1 block">
                  Must be 8+ characters and contain letters and at least one number or symbol.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={pwLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {pwLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
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
