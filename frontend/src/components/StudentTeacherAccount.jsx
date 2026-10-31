import React, { useState } from 'react';
import { KeyRound, LogOut, UserCheck, Sun, Moon } from 'lucide-react';
import ChangePasswordForm from './ChangePasswordForm';
import ClassPulseLogo from './ClassPulseLogo';
import { useTheme } from '../context/ThemeContext';

export default function StudentTeacherAccount({ user, onPasswordChanged, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const [showPasswordForm, setShowPasswordForm] = useState(user?.mustChangePassword || false);

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
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className={`w-4 h-4 ${user?.role === 'student' ? 'text-[#1E3A8A]' : (user?.role === 'teacher' ? 'text-emerald-600' : 'text-blue-600')}`} />
          )}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 space-y-6 text-center transition-colors duration-200">
        <div className="flex flex-col items-center justify-center">
          <ClassPulseLogo size="lg" className="mb-3 hover:scale-105 transition-transform duration-200" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Account Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authenticated as: <span className="font-semibold text-slate-700 dark:text-slate-300">{user.userId}</span> ({user.role})
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <button
            onClick={() => setShowPasswordForm(true)}
            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-transparent dark:border-slate-700"
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2.5 px-4 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
