import React, { useState } from 'react';
import { KeyRound, Loader2, AlertCircle, CheckCircle2, LogOut, Sun, Moon } from 'lucide-react';
import { authApi } from '../api';
import ClassPulseLogo from './ClassPulseLogo';
import { useTheme } from '../context/ThemeContext';

export default function ChangePasswordForm({ user, onPasswordChanged, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9!@#$%^&*])/.test(newPassword)) {
      setError('New password must contain letters and at least one number or symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password cannot be the same as current password.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess('Password updated successfully.');
      setTimeout(() => {
        onPasswordChanged(res.user);
      }, 800);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to change password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const roleStyles = {
    teacher: {
      btn: 'bg-emerald-600 hover:bg-emerald-700',
      ring: 'focus:ring-emerald-500',
      moon: 'text-emerald-600'
    },
    student: {
      btn: 'bg-[#1E3A8A] hover:bg-[#172554]',
      ring: 'focus:ring-[#1E3A8A]',
      moon: 'text-[#1E3A8A]'
    },
    admin: {
      btn: 'bg-blue-600 hover:bg-blue-700',
      ring: 'focus:ring-blue-500',
      moon: 'text-blue-600'
    }
  };
  const themeAccent = roleStyles[user?.role] || roleStyles.admin;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-6 relative transition-colors duration-200">
      {/* Quick Appearance Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={toggleTheme}
          type="button"
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2 text-xs font-medium"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className={`w-4 h-4 ${themeAccent.moon}`} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 space-y-6 transition-colors duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <ClassPulseLogo size="sm" />
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">ClassPulse</span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Change Password
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user?.mustChangePassword
                  ? 'Initial password change required before accessing system'
                  : 'Update your account security password'}
              </p>
            </div>
          </div>
        </div>

        {user?.mustChangePassword && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 rounded-lg text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            <strong>Security Notice:</strong> You are using temporary development credentials. You must set a new password to proceed.
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={loading}
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 ${themeAccent.ring} focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-50`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              disabled={loading}
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 ${themeAccent.ring} focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-50`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={loading}
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 ${themeAccent.ring} focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-50`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 px-4 ${themeAccent.btn} text-white rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Change Password</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
