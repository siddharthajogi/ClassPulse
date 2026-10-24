import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, X, ChevronDown, Plus, GraduationCap, AlertCircle } from 'lucide-react';
import { QUALIFICATION_OPTIONS, STANDARD_QUALIFICATIONS } from '../config/qualifications';

export default function QualificationMultiSelect({
  selected = [],
  onChange,
  error = '',
  label = 'Qualifications',
  required = true,
  disabled = false,
  id = 'qualification-multi-select'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [otherError, setOtherError] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const customInputRef = useRef(null);

  // Normalize selected to array of trimmed strings
  const selectedList = Array.isArray(selected)
    ? selected.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
    : [];

  // Check if any non-standard qualifications are currently selected
  const hasCustomQualifications = selectedList.some((q) => !STANDARD_QUALIFICATIONS.includes(q));

  // Determine if 'Other' option should be considered active
  const isOtherActive = showOtherInput || hasCustomQualifications;

  // Sync showOtherInput if custom qualifications are added externally
  useEffect(() => {
    if (hasCustomQualifications && !showOtherInput) {
      setShowOtherInput(true);
    }
  }, [hasCustomQualifications]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = QUALIFICATION_OPTIONS.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const handleToggleOption = (option) => {
    if (disabled) return;

    if (option === 'Other') {
      const nextShowOther = !isOtherActive;
      setShowOtherInput(nextShowOther);
      setOtherError('');

      if (!nextShowOther) {
        // If unchecking Other, remove all custom qualifications
        const newSelected = selectedList.filter((q) => STANDARD_QUALIFICATIONS.includes(q));
        onChange(newSelected);
        setOtherInput('');
      } else {
        setTimeout(() => {
          customInputRef.current?.focus();
        }, 100);
      }
      return;
    }

    // Standard option toggle
    if (selectedList.includes(option)) {
      // Remove
      onChange(selectedList.filter((item) => item !== option));
    } else {
      // Add (preventing duplicate)
      onChange([...selectedList, option]);
    }
  };

  const handleRemoveItem = (itemToRemove, e) => {
    if (e) e.stopPropagation();
    if (disabled) return;

    const newSelected = selectedList.filter((item) => item !== itemToRemove);
    onChange(newSelected);

    // If removing the last custom qualification, hide other input if desired
    if (!STANDARD_QUALIFICATIONS.includes(itemToRemove)) {
      const remainingCustom = newSelected.some((q) => !STANDARD_QUALIFICATIONS.includes(q));
      if (!remainingCustom && !otherInput) {
        setShowOtherInput(false);
      }
    }
  };

  const handleClearAll = (e) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    onChange([]);
    setShowOtherInput(false);
    setOtherInput('');
    setOtherError('');
  };

  const handleAddCustomQualification = () => {
    const clean = otherInput.trim();
    if (!clean) {
      setOtherError('Please enter a qualification name.');
      return;
    }

    // Check duplicate (case-insensitive)
    const exists = selectedList.some((item) => item.toLowerCase() === clean.toLowerCase());
    if (exists) {
      setOtherError(`"${clean}" is already selected.`);
      return;
    }

    setOtherError('');
    onChange([...selectedList, clean]);
    setOtherInput('');
  };

  const handleOtherKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomQualification();
    }
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {/* Label and Clear All */}
      <div className="flex justify-between items-center mb-1.5">
        <label
          htmlFor={`${id}-trigger`}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {selectedList.length > 1 && !disabled && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer font-medium"
          >
            Clear all ({selectedList.length})
          </button>
        )}
      </div>

      {/* Selected Chips Area */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 p-1.5 min-h-[38px] bg-slate-50/80 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-700/80 items-center">
          {selectedList.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 animate-in fade-in duration-100"
            >
              <span>{item}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(item, e)}
                  title={`Remove ${item}`}
                  aria-label={`Remove ${item}`}
                  className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800/60 text-indigo-500 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Trigger Button */}
      <button
        id={`${id}-trigger`}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left text-sm border rounded-lg flex items-center justify-between transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50'
            : 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-600'
        } ${
          error
            ? 'border-rose-500 ring-1 ring-rose-500'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <GraduationCap className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className={selectedList.length === 0 ? 'text-slate-400 dark:text-slate-500' : 'font-medium'}>
            {selectedList.length === 0
              ? 'Select qualifications (multiple allowed)...'
              : `${selectedList.length} qualification${selectedList.length > 1 ? 's' : ''} selected`}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search qualifications (e.g. M.Tech, Ph.D.)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                No matching qualifications found.
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleOption('Other');
                      setOtherInput(searchTerm.trim());
                      setSearchTerm('');
                    }}
                    className="block mx-auto mt-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
                  >
                    + Add "{searchTerm.trim()}" as custom qualification
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected =
                  opt === 'Other' ? isOtherActive : selectedList.includes(opt);

                return (
                  <label
                    key={opt}
                    onClick={(e) => {
                      e.preventDefault();
                      handleToggleOption(opt);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent label onClick
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer accent-indigo-600"
                      />
                      <span>{opt}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        Selected
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Quick instructions / count footer */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between items-center">
            <span>Multiple selections supported (e.g. B.Tech + M.Tech)</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* "Other" Custom Qualification Input Section */}
      {isOtherActive && (
        <div className="mt-2.5 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 animate-in fade-in duration-150">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Specify Custom Qualification <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              ref={customInputRef}
              type="text"
              value={otherInput}
              onChange={(e) => {
                setOtherInput(e.target.value);
                if (otherError) setOtherError('');
              }}
              onKeyDown={handleOtherKeyDown}
              disabled={disabled}
              placeholder="e.g. M.S., B.Arch, Post-Doctoral, PG Diploma"
              className={`flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                otherError
                  ? 'border-rose-500 ring-1 ring-rose-500'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            <button
              type="button"
              onClick={handleAddCustomQualification}
              disabled={disabled || !otherInput.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {otherError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
              {otherError}
            </p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Type your custom degree and press <kbd className="px-1 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 rounded font-mono">Enter</kbd> or click <strong>Add</strong>.
          </p>
        </div>
      )}

      {/* Main Field Error Message */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
