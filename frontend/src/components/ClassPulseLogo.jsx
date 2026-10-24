import React from 'react';
import cpLogo from '../assets/cp-logo.png';

/**
 * ClassPulseLogo Component
 * 
 * Reusable branding component for ClassPulse application displaying
 * the interlocking C and P gradient logo in navy-blue, teal, green, and cyan.
 * 
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|'2xl'} size - Dimension preset
 * @param {string} className - Optional container CSS classes
 * @param {string} imgClassName - Optional img element CSS classes
 * @param {'icon'|'badge'|'full'} variant - Display mode
 * @param {boolean} animated - Optional subtle breathing/pulse effect
 * @param {string} subtitle - Optional portal subtitle (e.g. "Admin Portal")
 */
export default function ClassPulseLogo({
  size = 'md',
  className = '',
  imgClassName = '',
  variant = 'icon',
  animated = false,
  subtitle,
  alt = 'ClassPulse'
}) {
  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
    xl: 'w-16 h-16 sm:w-20 sm:h-20',
    '2xl': 'w-24 h-24 sm:w-28 sm:h-28'
  };

  const badgeSizeMap = {
    xs: 'p-1 rounded-lg',
    sm: 'p-1.5 rounded-xl',
    md: 'p-2 rounded-2xl',
    lg: 'p-3 rounded-2xl',
    xl: 'p-4 rounded-3xl',
    '2xl': 'p-5 rounded-3xl'
  };

  const currentSizeClass = sizeMap[size] || size;
  const currentBadgeClass = badgeSizeMap[size] || 'p-2 rounded-2xl';

  const logoImage = (
    <img
      src={cpLogo}
      alt={alt}
      className={`object-contain select-none transition-transform duration-200 group-hover:scale-105 ${currentSizeClass} ${
        animated ? 'animate-pulse' : ''
      } ${imgClassName}`}
      loading="eager"
      decoding="async"
    />
  );

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-slate-950/40 group transition-all duration-200 ${currentBadgeClass} ${className}`}
      >
        {logoImage}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-3 group ${className}`}>
        <div className="relative shrink-0 flex items-center justify-center">
          {logoImage}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
            ClassPulse
          </span>
          {subtitle && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {logoImage}
    </div>
  );
}
