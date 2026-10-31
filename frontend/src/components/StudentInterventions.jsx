import React from 'react';
import { HeartHandshake, ShieldCheck, CheckCircle2, LifeBuoy, AlertCircle, BookOpen } from 'lucide-react';

export default function StudentInterventions() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              My Interventions / Support
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
              Good Standing
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Teacher-approved academic recovery plans, mentorship sessions, and student support checkpoints.
          </p>
        </div>
      </div>

      {/* Interventions Empty / Status Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 border border-slate-200 dark:border-slate-800 text-center max-w-2xl mx-auto shadow-xs space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
          No Active Interventions Required
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          You currently have no active intervention flags or mandatory recovery plans assigned. When teachers initiate academic support or remedial counseling checkpoints, details and scheduled meetings will appear here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Academic Standing</h4>
            <p className="text-[11px] text-slate-400">No critical risk flags detected in your coursework</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <LifeBuoy className="w-5 h-5 text-[#1E3A8A] dark:text-blue-400 mb-1" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Need Guidance?</h4>
            <p className="text-[11px] text-slate-400">Reach out to your department coordinator or mentor</p>
          </div>
        </div>
      </div>
    </div>
  );
}
