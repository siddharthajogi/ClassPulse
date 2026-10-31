import React from 'react';
import { RefreshCw, AlertCircle, X } from 'lucide-react';
import { useRefresh } from '../context/RefreshContext';

export default function HeaderRefreshButton({ portal = 'admin', className = '' }) {
  const { isRefreshing, refreshError, setRefreshError, triggerRefresh } = useRefresh();

  // Portal-specific theme styling matching each portal's exact header palette
  const portalStyles = {
    teacher: {
      hover: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-300',
      icon: 'text-emerald-600 dark:text-emerald-400',
      activeRing: 'focus-visible:ring-emerald-500/40',
    },
    student: {
      hover: 'hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 hover:text-[#1E3A8A] dark:hover:text-blue-300',
      icon: 'text-[#1E3A8A] dark:text-blue-400',
      activeRing: 'focus-visible:ring-blue-500/40',
    },
    admin: {
      hover: 'hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300',
      icon: 'text-indigo-600 dark:text-indigo-400',
      activeRing: 'focus-visible:ring-indigo-500/40',
    },
  };

  const currentPortal = portalStyles[portal] || portalStyles.admin;

  return (
    <div className="relative inline-flex items-center">
      <button
        id="header-global-refresh-btn"
        data-testid="header-global-refresh-btn"
        type="button"
        onClick={triggerRefresh}
        disabled={isRefreshing}
        title="Refresh current page"
        aria-label="Refresh current page"
        aria-busy={isRefreshing}
        className={`relative inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 ${currentPortal.activeRing} ${currentPortal.hover} ${className}`}
      >
        <RefreshCw
          className={`w-4 h-4 shrink-0 transition-transform duration-300 ${currentPortal.icon} ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          aria-hidden="true"
        />
        <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
      </button>

      {/* Floating Refresh Error Toast Feedback */}
      {refreshError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-16 right-4 sm:right-8 z-50 flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-2xl shadow-xl text-xs sm:text-sm max-w-sm animate-in fade-in slide-in-from-top-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="flex-1 font-medium">{refreshError}</span>
          <button
            type="button"
            onClick={() => setRefreshError(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ml-1"
            title="Dismiss error"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
