import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function Placeholder({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 space-y-4">
      <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600" />
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="max-w-md text-center">This module is part of the roadmap but has not yet been fully implemented in this phase.</p>
    </div>
  );
}
