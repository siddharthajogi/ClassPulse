import React from 'react';
import { Sparkles, BookOpen, Target, CheckCircle2, Lightbulb, Compass } from 'lucide-react';

export default function StudentPersonalizedLearning() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Personalized Learning
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80">
              Adaptive Modules
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Custom-tailored practice modules, prerequisite remediation, and adaptive study resources.
          </p>
        </div>
      </div>

      {/* Informative Guidance & Empty State */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 border border-slate-200 dark:border-slate-800 text-center max-w-2xl mx-auto shadow-xs space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/80 flex items-center justify-center mx-auto text-violet-600 dark:text-violet-400">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
          No Personalized Modules Assigned Yet
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          ClassPulse's adaptive learning engine and your instructors generate tailored study paths based on your topic diagnostic assessments. When practice sets or revision plans are assigned, they will be listed here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <Target className="w-5 h-5 text-indigo-500 mb-1" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Targeted Practice</h4>
            <p className="text-[11px] text-slate-400">Focus on difficult concept prerequisites</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <Compass className="w-5 h-5 text-violet-500 mb-1" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Adaptive Pace</h4>
            <p className="text-[11px] text-slate-400">Personalized revision sets customized to your schedule</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <Lightbulb className="w-5 h-5 text-amber-500 mb-1" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Faculty Feedback</h4>
            <p className="text-[11px] text-slate-400">Direct recommendations from subject teachers</p>
          </div>
        </div>
      </div>
    </div>
  );
}
