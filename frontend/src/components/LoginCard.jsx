import React, { useState, useEffect } from 'react';
import { GraduationCap, BookOpen, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

const roleMeta = {
  student: {
    title: 'Student',
    subtitle: 'Access coursework & academic records',
    idLabel: 'Student ID',
    idPlaceholder: 'Enter your Student ID',
    buttonText: 'Login',
    icon: GraduationCap,
    accentColor: 'border-purple-200 dark:border-purple-900/50 hover:border-purple-400 dark:hover:border-purple-700 focus-within:border-purple-500',
    iconBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400',
    btnClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    focusRing: 'focus:ring-purple-500'
  },
  teacher: {
    title: 'Teacher',
    subtitle: 'Manage classes & academic grading',
    idLabel: 'Teacher ID',
    idPlaceholder: 'Enter your Teacher ID',
    buttonText: 'Login',
    icon: BookOpen,
    accentColor: 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-700 focus-within:border-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    focusRing: 'focus:ring-emerald-500'
  },
  admin: {
    title: 'Admin',
    subtitle: 'Institutional control & governance',
    idLabel: 'Admin ID',
    idPlaceholder: 'Enter your Admin ID',
    buttonText: 'Login',
    icon: ShieldCheck,
    accentColor: 'border-blue-200 dark:border-blue-900/50 hover:border-blue-400 dark:hover:border-blue-700 focus-within:border-blue-500',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    focusRing: 'focus:ring-blue-500'
  }
};

export default function LoginCard({ role, onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Guarantee fields are completely empty on mount
  useEffect(() => {
    setUserId('');
    setPassword('');
  }, []);

  const meta = roleMeta[role] || roleMeta.student;
  const RoleIcon = meta.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanId = userId.trim();
    if (!cleanId) {
      setError(`Please enter your ${meta.idLabel}.`);
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await onLoginSuccess({ userId: cleanId, password, role });
    } catch (err) {
      let errMsg = 'Authentication failed. Please check credentials.';
      if (err.response) {
        if (err.response.data?.error && err.response.data.error !== 'Internal Server Error') {
          errMsg = err.response.data.error;
        } else if (err.response.status === 503) {
          errMsg = err.response.data?.error || 'Database service is temporarily unavailable. Please try again in a few moments.';
        } else if (err.response.status === 500) {
          errMsg = 'An unexpected server error occurred. Please try again later.';
        } else if (err.response.status === 401) {
          errMsg = err.response.data?.error || 'Invalid credentials. Please verify your ID and password.';
        } else if (err.response.status === 403) {
          errMsg = err.response.data?.error || 'This account has been deactivated. Please contact administration.';
        } else {
          errMsg = err.response.data?.message || err.response.data?.error || errMsg;
        }
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        errMsg = 'Cannot connect to the server. Please ensure the backend is running.';
      } else if (err.message) {
        errMsg = err.message;
      }
      
      setError(errMsg);
      // Clear password on failed attempt
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border ${meta.accentColor} shadow-sm hover:shadow-md transition-all duration-200 p-6 sm:p-8 flex flex-col justify-between`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className={`p-3 rounded-xl ${meta.iconBg}`}>
            <RoleIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {meta.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Error Notification inside the card */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Independent Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
          {/* Hidden decoy fields to intercept browser autofill engines */}
          <input
            type="text"
            name={`fake_user_${role}`}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <input
            type="password"
            name={`fake_pass_${role}`}
            tabIndex={-1}
            autoComplete="new-password"
            className="hidden"
            aria-hidden="true"
          />

          <div>
            <label
              htmlFor={`${role}-userId`}
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {meta.idLabel}
            </label>
            <input
              id={`${role}-userId`}
              name={`${role}_id_input`}
              type="text"
              autoComplete="off"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={meta.idPlaceholder}
              disabled={loading}
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 ${meta.focusRing} focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-50`}
            />
          </div>

          <div>
            <label
              htmlFor={`${role}-password`}
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Password
            </label>
            <input
              id={`${role}-password`}
              name={`${role}_pwd_input`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 ${meta.focusRing} focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-50`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${meta.btnClass}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>{meta.buttonText}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
