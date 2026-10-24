import React, { useEffect, useRef } from 'react';
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react';

/**
 * Reusable centered Delete Confirmation Popup for ClassPulse.
 * 
 * @param {boolean} isOpen - Whether modal is visible.
 * @param {function} onClose - Cancel handler (also triggered by Escape key).
 * @param {function} onConfirm - Permanent delete trigger.
 * @param {string} [title="Delete Permanently?"] - Header title.
 * @param {string} [recordName] - Name or identifier of record to delete (e.g. "John Doe (s2026001)").
 * @param {string} [message] - Custom description (falls back to requirement text).
 * @param {boolean} [loading=false] - If deletion request is currently executing.
 * @param {string} [error] - Error message if backend rejection occurs.
 */
export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Permanently?',
  recordName = '',
  message = 'Are you sure you want to permanently delete this record? This action cannot be undone.',
  loading = false,
  error = '',
  children = null,
  confirmText = 'Permanently Delete',
  confirmDisabled = false,
  maxWidth = 'max-w-md',
  secondaryAction = null
}) {
  const cancelButtonRef = useRef(null);

  // Keyboard accessibility: Escape key to cancel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Focus the cancel button on open so pressing Enter doesn't trigger deletion accidentally
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        // Prevent background clicks from accidentally triggering deletion
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
    >
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 relative transition-all duration-200 transform animate-in zoom-in-95 max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon in corner */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Prominent Trash Warning Icon */}
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-inner">
            <Trash2 className="w-7 h-7" />
          </div>

          {/* Title */}
          <h2
            id="delete-modal-title"
            className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight"
          >
            {title}
          </h2>

          {/* Record Identifier Highlight (if available) */}
          {recordName && (
            <div className="mt-2.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 max-w-full">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {recordName}
              </span>
            </div>
          )}

          {/* Message */}
          <p
            id="delete-modal-description"
            className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed"
          >
            {message}
          </p>

          {/* Custom Body / Dependency Resolution Workflow */}
          {children}

          {/* Backend Error Alert (if any dependency/deletion failure occurs) */}
          {error && (
            <div className="w-full mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs text-left flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Secondary Action Option (e.g. Deactivate Account Instead) */}
          {secondaryAction && (
            <div className="w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                onClick={secondaryAction.onClick}
                disabled={loading || secondaryAction.disabled}
                className="w-full py-2 px-3 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-900/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {secondaryAction.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{secondaryAction.label}</span>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full grid grid-cols-2 gap-3 mt-6">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || confirmDisabled}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
