import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  CalendarCheck, 
  BookOpenCheck, 
  TrendingUp, 
  Sparkles, 
  HeartHandshake, 
  Bell, 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  Check, 
  ChevronDown, 
  Menu, 
  X 
} from 'lucide-react';
import ClassPulseLogo from './ClassPulseLogo';
import { useTheme } from '../context/ThemeContext';
import { studentApi } from '../api';

const getStudentPageName = (pathname) => {
  const cleanPath = pathname.replace(/\/+$/, '');

  if (cleanPath === '/student' || cleanPath === '/student/dashboard') return 'Dashboard';
  if (cleanPath === '/student/subjects') return 'My Subjects';
  if (cleanPath === '/student/academic-records') return 'My Academic Records';
  if (cleanPath === '/student/attendance') return 'My Attendance';
  if (cleanPath === '/student/assignments') return 'My Assignments';
  if (cleanPath === '/student/learning-progress') return 'My Learning Progress';
  if (cleanPath === '/student/personalized-learning') return 'Personalized Learning';
  if (cleanPath === '/student/interventions' || cleanPath === '/student/learning-support') return 'My Interventions / Support';
  if (cleanPath === '/student/notifications') return 'Notifications';
  if (cleanPath === '/student/profile') return 'My Profile';

  const segment = cleanPath.replace('/student/', '').split('/')[0];
  if (!segment) return 'Dashboard';
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function StudentLayout({ onLogout, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const currentPageName = getStudentPageName(location.pathname);

  // Mobile sidebar drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme Dropdown State
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef(null);

  // Unread notifications count
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await studentApi.getNotifications();
      if (res && res.success) {
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Quiet fail if notifications not active
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname]);

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

  // 10 items in exact required order:
  // 1. Dashboard
  // 2. My Subjects
  // 3. My Academic Records
  // 4. My Attendance
  // 5. My Assignments
  // 6. My Learning Progress
  // 7. Personalized Learning
  // 8. My Interventions / Support
  // 9. Notifications
  // 10. My Profile
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/student/dashboard' },
    { name: 'My Subjects', icon: BookOpen, path: '/student/subjects' },
    { name: 'My Academic Records', icon: FileText, path: '/student/academic-records' },
    { name: 'My Attendance', icon: CalendarCheck, path: '/student/attendance' },
    { name: 'My Assignments', icon: BookOpenCheck, path: '/student/assignments' },
    { name: 'My Learning Progress', icon: TrendingUp, path: '/student/learning-progress' },
    { name: 'Personalized Learning', icon: Sparkles, path: '/student/personalized-learning' },
    { name: 'My Interventions / Support', icon: HeartHandshake, path: '/student/interventions' },
    { name: 'Notifications', icon: Bell, path: '/student/notifications', badge: unreadCount },
    { name: 'My Profile', icon: User, path: '/student/profile' }
  ];

  const renderNavLinks = (closeMobile = false) => (
    <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/student/dashboard'}
          onClick={() => {
            if (closeMobile) setMobileMenuOpen(false);
          }}
          className={({ isActive }) =>
            `group flex items-center justify-between px-3 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all duration-150 ${
              isActive
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border-l-4 border-indigo-600 dark:border-indigo-500 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="flex items-center gap-3">
                <item.icon
                  className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-colors ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                  {item.badge}
                </span>
              )}
            </>
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
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
            Student Portal
          </span>
        </div>

        {/* 10 Navigation Links in Specified Order */}
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
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    Student Portal
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
              <Menu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </button>

            <ClassPulseLogo size="xs" className="hidden sm:block md:hidden shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentPageName}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Top-Header Notifications Button */}
            <Link
              to="/student/notifications"
              className={`relative inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                location.pathname === '/student/notifications'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-2xs font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`}
              title="Student Notifications"
              aria-label="Student Notifications"
            >
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 animate-pulse" />
              )}
            </Link>

            {/* Theme Control & Dropdown Selector */}
            <div className="relative" ref={themeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsThemeOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                  isThemeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-indigo-400 dark:border-indigo-600 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Select Theme"
                aria-label="Select Theme"
                aria-haspopup="true"
                aria-expanded={isThemeOpen}
              >
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
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
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border-l-[3px] border-indigo-600 dark:border-indigo-400 pl-2.5'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Light Mode</span>
                    </div>
                    {theme === 'light' && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
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
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border-l-[3px] border-indigo-600 dark:border-indigo-400 pl-2.5'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5">
                      <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Dark Mode</span>
                    </div>
                    {theme === 'dark' && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
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

        {/* Dynamic Outlet View for Student Pages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet context={{ currentUser, onLogout: handleLogout }} />
        </div>
      </main>
    </div>
  );
}
