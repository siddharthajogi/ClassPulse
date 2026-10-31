import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Layers, 
  Users, 
  Activity, 
  Target, 
  Sparkles, 
  CheckSquare, 
  FileText, 
  CalendarCheck, 
  BookOpenCheck, 
  TrendingUp, 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  Bell, 
  Check, 
  ChevronDown, 
  Menu, 
  X 
} from 'lucide-react';
import ClassPulseLogo from './ClassPulseLogo';
import { useTheme } from '../context/ThemeContext';
import HeaderRefreshButton from './HeaderRefreshButton';

const getTeacherPageName = (pathname) => {
  const cleanPath = pathname.replace(/\/+$/, '');

  if (cleanPath === '/teacher' || cleanPath === '/teacher/dashboard') return 'Dashboard';
  if (cleanPath === '/teacher/subjects') return 'My Subjects';
  if (cleanPath === '/teacher/classes') return 'My Classes';
  if (cleanPath.startsWith('/teacher/classes/')) return 'Section Details';
  if (cleanPath === '/teacher/students') return 'Students';
  if (cleanPath === '/teacher/risk-analytics') return 'Student Risk Analytics';
  if (cleanPath === '/teacher/knowledge-gaps') return 'Knowledge-Gap Analysis';
  if (cleanPath === '/teacher/personalized-learning') return 'Personalized Learning';
  if (cleanPath === '/teacher/intervention-review') return 'Intervention Review';
  if (cleanPath === '/teacher/academic-records') return 'Academic Records';
  if (cleanPath === '/teacher/attendance') return 'Attendance';
  if (cleanPath === '/teacher/assignments') return 'Assignments';
  if (cleanPath === '/teacher/learning-improvement') return 'Learning Improvement';
  if (cleanPath === '/teacher/profile') return 'My Profile';
  if (cleanPath === '/teacher/notifications') return 'Notifications';

  const segment = cleanPath.replace('/teacher/', '').split('/')[0];
  if (!segment) return 'Dashboard';
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function TeacherLayout({ onLogout, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const currentPageName = getTeacherPageName(location.pathname);

  // Mobile sidebar drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme Dropdown State
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef(null);

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    }
    navigate('/');
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close theme dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target)) {
        setIsThemeOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsThemeOpen(false);
      }
    };

    if (isThemeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeOpen]);

  // Exact 13 items in the required order:
  // 1. Dashboard
  // 2. My Subjects
  // 3. My Classes
  // 4. Students
  // 5. Student Risk Analytics
  // 6. Knowledge-Gap Analysis
  // 7. Personalized Learning
  // 8. Intervention Review
  // 9. Academic Records
  // 10. Attendance
  // 11. Assignments
  // 12. Learning Improvement
  // 13. My Profile
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/teacher/dashboard' },
    { name: 'My Subjects', icon: BookOpen, path: '/teacher/subjects' },
    { name: 'My Classes', icon: Layers, path: '/teacher/classes' },
    { name: 'Students', icon: Users, path: '/teacher/students' },
    { name: 'Student Risk Analytics', icon: Activity, path: '/teacher/risk-analytics' },
    { name: 'Knowledge-Gap Analysis', icon: Target, path: '/teacher/knowledge-gaps' },
    { name: 'Personalized Learning', icon: Sparkles, path: '/teacher/personalized-learning' },
    { name: 'Intervention Review', icon: CheckSquare, path: '/teacher/intervention-review' },
    { name: 'Academic Records', icon: FileText, path: '/teacher/academic-records' },
    { name: 'Attendance', icon: CalendarCheck, path: '/teacher/attendance' },
    { name: 'Assignments', icon: BookOpenCheck, path: '/teacher/assignments' },
    { name: 'Learning Improvement', icon: TrendingUp, path: '/teacher/learning-improvement' },
    { name: 'My Profile', icon: User, path: '/teacher/profile' }
  ];

  const renderNavLinks = (closeMobile = false) => (
    <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/teacher/dashboard'}
          onClick={() => {
            if (closeMobile) setMobileMenuOpen(false);
          }}
          className={({ isActive }) =>
            `group flex items-center justify-between px-3 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all duration-150 ${
              isActive
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border-l-4 border-emerald-600 dark:border-emerald-500 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`
          }
        >
          {({ isActive }) => (
            <div className="flex items-center gap-3">
              <item.icon
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-colors ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                }`}
              />
              <span>{item.name}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Desktop & Tablet Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col hidden md:flex transition-colors duration-200 shrink-0">
        <div className="pt-7 pb-5 px-4 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center mb-2.5">
            <ClassPulseLogo size="lg" className="hover:scale-105 transition-transform duration-200" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            ClassPulse
          </h2>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            Teacher Portal
          </span>
        </div>

        {/* 13 Navigation Links in Specified Order */}
        {renderNavLinks(false)}

        {/* Bottom of Sidebar: Logout */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl z-10 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ClassPulseLogo size="sm" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    ClassPulse
                  </h2>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Teacher Portal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavLinks(true)}

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header: Notifications button, Theme selector, Mobile hamburger */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3.5 flex justify-between items-center transition-colors duration-200 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl md:hidden cursor-pointer"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </button>

            <ClassPulseLogo size="xs" className="hidden sm:block md:hidden shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentPageName}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* 1. Global Refresh Button */}
            <HeaderRefreshButton portal="teacher" />

            {/* 2. Top-Header Notifications Button (Emerald themed) */}
            <Link
              to="/teacher/notifications"
              className={`relative inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                location.pathname === '/teacher/notifications'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-300'
              }`}
              title="Teacher Notifications"
              aria-label="Teacher Notifications"
            >
              <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Notifications</span>
            </Link>

            {/* Theme Control & Dropdown Selector */}
            <div className="relative" ref={themeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsThemeOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                  isThemeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-emerald-400 dark:border-emerald-600 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Select Theme"
                aria-label="Select Theme"
                aria-haspopup="true"
                aria-expanded={isThemeOpen}
              >
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>Theme</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isThemeOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Theme Dropdown Card */}
              {isThemeOpen && (
                <div
                  className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 p-1.5 transition-all animate-in fade-in slide-in-from-top-2 focus:outline-none"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1">
                    Theme Preference
                  </div>

                  {/* Light Mode Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      setIsThemeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-xl transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border-l-[3px] border-emerald-600 dark:border-emerald-400 pl-2.5'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Light Mode</span>
                    </div>
                    {theme === 'light' && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>

                  {/* Dark Mode Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      setIsThemeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-xl transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border-l-[3px] border-emerald-600 dark:border-emerald-400 pl-2.5'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5">
                      <Moon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Dark Mode</span>
                    </div>
                    {theme === 'dark' && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Quick Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors md:hidden cursor-pointer"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dynamic Outlet View for Teacher Pages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet context={{ currentUser, onLogout: handleLogout }} />
        </div>
      </main>
    </div>
  );
}
