import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { ChevronDown, Check, X, RotateCcw } from 'lucide-react';

/**
 * TeacherDropdown - Accessible, Theme-Aware Shared Dropdown Component
 *
 * Implements WAI-ARIA Combobox / Listbox pattern with:
 * - Full Dark Mode and Light Mode support with distinct green/teal active states
 * - High-contrast readable option text in both themes
 * - Removal of duplicate default options when default is active
 * - Clear reset option and trigger reset button when a filter is applied
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Space, Escape, Home, End, Tab, Type-ahead)
 * - Click-outside and touch dismissal
 * - Auto-scroll to focused option
 * - Non-clipping, word-wrapping options for long department and course names
 * - High z-index (z-50) ensuring menus float cleanly above cards and containers
 * - Full backward compatibility with existing (e) => handler signatures
 */
export default function TeacherDropdown({
  id: explicitId,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  label,
  className = '',
  menuClassName = '',
  disabled = false,
  title,
  icon: Icon,
  align = 'left',
  'data-testid': dataTestId,
  autoWidth = false,
  alwaysShowDefaultOption = true,
}) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const listboxId = `${id}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [openUpwards, setOpenUpwards] = useState(false);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxRef = useRef(null);
  const typeAheadQueryRef = useRef('');
  const typeAheadTimerRef = useRef(null);

  // Helper to determine if an option represents a default/all/reset choice
  const checkIfDefault = (optVal, optLbl, explicitIsDefault) => {
    if (explicitIsDefault !== undefined) return Boolean(explicitIsDefault);
    const valStr = optVal !== undefined && optVal !== null ? String(optVal).trim().toLowerCase() : '';
    const lblStr = typeof optLbl === 'string' ? optLbl.trim().toLowerCase() : '';

    // Explicit 'all', 'all_items', or empty string value
    if (valStr === 'all' || valStr === 'all_items' || valStr === '') return true;

    // Label starts with 'all ' (e.g. 'All Departments', 'All Calendar Years')
    // and value represents a default/reset value (not a specific year or ID)
    if (lblStr.startsWith('all ') && (valStr === 'all' || valStr === '' || valStr === '0' || valStr === 'null')) {
      return true;
    }

    return false;
  };

  // Normalize options into { value, label, subtext, disabled, isDefault }
  const normalizedOptions = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        const isDef = checkIfDefault(opt, String(opt));
        return { value: opt, label: String(opt), disabled: false, isDefault: isDef };
      }
      if (opt && typeof opt === 'object') {
        const val = opt.value !== undefined ? opt.value : opt._id || opt.id || opt.name || '';
        const lbl = opt.label !== undefined ? opt.label : opt.name || opt.year || opt.title || String(val);
        const isDef = checkIfDefault(val, lbl, opt.isDefault);
        return {
          value: val,
          label: lbl,
          subtext: opt.subtext || (opt.code && opt.code !== lbl ? opt.code : null),
          disabled: Boolean(opt.disabled),
          isDefault: isDef,
        };
      }
      return { value: '', label: '', disabled: false, isDefault: false };
    });
  }, [options]);

  // Find default/reset option (if any)
  const defaultOption = normalizedOptions.find((opt) => opt.isDefault);

  // Check whether the currently active selection is the default option
  const isDefaultSelected = Boolean(
    value === undefined ||
    value === null ||
    String(value).trim().toLowerCase() === 'all' ||
    String(value).trim() === '' ||
    (defaultOption && String(value) === String(defaultOption.value))
  );

  // Options rendered in the opened listbox:
  // When default selection is currently displayed on the button, omit it from the opened listbox
  // so the user does NOT see a redundant duplicate.
  // When a specific filter value is selected, include the default option at the top so users
  // can clearly reset the filter.
  const visibleOptions = React.useMemo(() => {
    if (alwaysShowDefaultOption) {
      return normalizedOptions;
    }
    if (isDefaultSelected) {
      return normalizedOptions.filter((opt) => !opt.isDefault);
    }
    return normalizedOptions;
  }, [normalizedOptions, isDefaultSelected, alwaysShowDefaultOption]);

  // Find currently selected option across all normalized options (for display text resolution)
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));
  const displayText = selectedOption ? selectedOption.label : (defaultOption ? defaultOption.label : placeholder);

  // Find index in visible options for keyboard focus / scrolling
  const visibleSelectedIndex = visibleOptions.findIndex((opt) => String(opt.value) === String(value));

  // Determine if menu should open upwards or downwards based on viewport space
  const calculateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // If less than 240px below and more space above, open upwards
    setOpenUpwards(spaceBelow < 250 && spaceAbove > spaceBelow);
  }, []);

  const openDropdown = () => {
    if (disabled) return;
    calculateMenuPosition();
    setIsOpen(true);
    const initialIndex = visibleSelectedIndex >= 0 ? visibleSelectedIndex : 0;
    setFocusedIndex(initialIndex < visibleOptions.length ? initialIndex : 0);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const handleSelect = (opt) => {
    if (opt.disabled) return;
    closeDropdown();
    triggerRef.current?.focus();

    if (onChange) {
      // Provide both event-like object (e.target.value) and direct value argument
      const syntheticEvent = {
        target: { name, value: opt.value },
        currentTarget: { name, value: opt.value },
        value: opt.value,
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent, opt.value);
    }
  };

  const handleClear = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const resetOpt = defaultOption || { value: 'all', label: placeholder };
    handleSelect(resetOpt);
  };

  // Close when clicking or touching outside
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    const handleScrollOrResize = () => {
      calculateMenuPosition();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, calculateMenuPosition]);

  // Ensure focused option is scrolled into view in listbox
  useEffect(() => {
    if (!isOpen || focusedIndex < 0 || !listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll('[role="option"]');
    if (items[focusedIndex]) {
      items[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < visibleOptions.length && visibleOptions[next].disabled) {
            next++;
          }
          return next < visibleOptions.length ? next : prev;
        });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && visibleOptions[next].disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;
      }
      case 'Home': {
        e.preventDefault();
        const first = visibleOptions.findIndex((opt) => !opt.disabled);
        if (first >= 0) setFocusedIndex(first);
        break;
      }
      case 'End': {
        e.preventDefault();
        for (let i = visibleOptions.length - 1; i >= 0; i--) {
          if (!visibleOptions[i].disabled) {
            setFocusedIndex(i);
            break;
          }
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < visibleOptions.length) {
          handleSelect(visibleOptions[focusedIndex]);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        closeDropdown();
        break;
      }
      default: {
        // Type-ahead functionality (single character or sequence search)
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          clearTimeout(typeAheadTimerRef.current);
          typeAheadQueryRef.current += e.key.toLowerCase();
          const query = typeAheadQueryRef.current;

          const matchIndex = visibleOptions.findIndex((opt) =>
            opt.label.toLowerCase().startsWith(query) && !opt.disabled
          );

          if (matchIndex >= 0) {
            setFocusedIndex(matchIndex);
          }

          typeAheadTimerRef.current = setTimeout(() => {
            typeAheadQueryRef.current = '';
          }, 600);
        }
        break;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${autoWidth ? 'w-auto' : 'w-full sm:w-auto'}`}
      data-testid={dataTestId ? `${dataTestId}-wrapper` : undefined}
    >
      {/* Hidden native input for form compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value !== undefined && value !== null ? value : ''}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={label || title || placeholder}
        aria-disabled={disabled}
        disabled={disabled}
        title={title || (selectedOption ? selectedOption.label : undefined)}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        data-testid={dataTestId}
        className={`group flex items-center justify-between gap-2 px-3 py-2 min-h-[38px] rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none shadow-2xs border ${
          isOpen
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/25 dark:ring-emerald-500/30'
            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
        } ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {Icon && (
            <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          )}
          <span
            className={`truncate block ${
              isDefaultSelected
                ? 'text-slate-700 dark:text-slate-300 font-medium'
                : 'text-slate-900 dark:text-slate-100 font-semibold'
            }`}
          >
            {displayText}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Quick Clear / Reset Icon Button when filtered */}
          {!disabled && !isDefaultSelected && defaultOption && (
            <span
              role="button"
              tabIndex={0}
              title={`Reset to ${defaultOption.label}`}
              aria-label={`Reset to ${defaultOption.label}`}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e);
                }
              }}
              className="p-0.5 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}

          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
              isOpen
                ? 'rotate-180 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Popover Menu / Listbox */}
      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={label || placeholder}
          className={`absolute ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${
            align === 'right' ? 'right-0' : 'left-0'
          } z-50 min-w-full sm:min-w-[240px] max-w-[380px] max-h-64 overflow-y-auto rounded-2xl p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/60 focus:outline-none scrollbar-thin transition-all animate-in fade-in duration-100 ${
            openUpwards ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
          } ${menuClassName}`}
        >
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 text-center italic">
              No options available
            </div>
          ) : (
            visibleOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isFocused = idx === focusedIndex;
              const isResetItem = opt.isDefault && !isDefaultSelected;

              return (
                <React.Fragment key={`${opt.value}-${idx}`}>
                  <div
                    id={`${listboxId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`relative flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer select-none ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600'
                        : isResetItem
                        ? isFocused
                          ? 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 font-medium'
                          : 'text-emerald-700 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                        : isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border-l-[3px] border-emerald-600 dark:border-emerald-400 pl-2.5'
                        : isFocused
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    data-testid={dataTestId ? `${dataTestId}-option-${opt.value}` : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 whitespace-normal break-words leading-snug">
                      {isResetItem && (
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="block">{opt.label}</span>
                        {isResetItem ? (
                          <span className="block text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                            Reset filter to show all
                          </span>
                        ) : opt.subtext ? (
                          <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                            {opt.subtext}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isSelected && !isResetItem && (
                      <Check
                        className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* Subtle separator below the reset option */}
                  {isResetItem && idx === 0 && (
                    <div className="my-1 border-b border-slate-100 dark:border-slate-800" role="separator" />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shared section name cleaner that extracts the core section identifier (e.g. "A", "B", "1").
 * Removes:
 * - Parenthetical department/course info: "(Computer Science and Engineering)"
 * - Degree / Department prefixes: "CSE - ", "B.Tech - ", "CSE:"
 * - Redundant "Section" or "Sec" prefixes: "Section A", "Sec. B"
 */
export function cleanSectionName(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  // Check for explicit "Sec(tion) <letter/number>" pattern anywhere (e.g. inside parentheses or at end)
  const secMatch = str.match(/\b(?:section|sec)\.?\s*([A-Za-z0-9]+)\b/i);
  if (secMatch) {
    return secMatch[1].toUpperCase();
  }
  // Otherwise strip parenthetical text e.g. "(Computer Science and Engineering)"
  str = str.replace(/\([^)]*\)/g, '').trim();
  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    str = parts[parts.length - 1].trim();
  }
  if (str.includes(':')) {
    const parts = str.split(':');
    str = parts[parts.length - 1].trim();
  }
  str = str.replace(/^(CSE|ECE|EEE|MECH|CIVIL|IT|CS|B\.?Tech|M\.?Tech|MBA|MCA)\s*[-:]?\s*/i, '').trim();
  str = str.replace(/^(section|sec)\.?\s*[-:]?\s*/i, '').trim();
  return str.toUpperCase();
}

/**
 * Shared section display label formatter for teacher dropdowns.
 * Formats clean, simple labels: "Section A", "Section B", "Section C".
 * Ensures department names, course names, and degree prefixes are completely removed.
 */
export function formatSectionLabel(rawSection) {
  const clean = cleanSectionName(rawSection);
  if (!clean) return 'Section';
  return `Section ${clean}`;
}

