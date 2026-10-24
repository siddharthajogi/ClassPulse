import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  GraduationCap, 
  BookOpen, 
  Settings, 
  LogOut, 
  Activity, 
  FileText, 
  Sun,
  Moon,
  Bell,
  Check,
  ChevronDown
} from 'lucide-react';
import ClassPulseLogo from './ClassPulseLogo';
import { useTheme } from '../context/ThemeContext';
import { adminApi } from '../api';

const getCurrentPageName = (pathname) => {
  const cleanPath = pathname.replace(/\/+$/, '');

  // Exact mappings
  if (cleanPath === '/admin' || cleanPath === '/admin/dashboard') return 'Dashboard';
  if (cleanPath === '/admin/notifications') return 'Notifications';
  if (cleanPath === '/admin/classes' || cleanPath === '/admin/assignments') return 'Departments & Sections';
  if (cleanPath === '/admin/profile') return 'My Profile';
  if (cleanPath === '/admin/students') return 'Manage Students';
  if (cleanPath === '/admin/students/create') return 'Add Student';
  if (cleanPath.startsWith('/admin/students/')) return 'Student Profile';
  if (cleanPath === '/admin/teachers') return 'Manage Teachers';
  if (cleanPath === '/admin/teachers/create') return 'Add Teacher';
  if (cleanPath.startsWith('/admin/teachers/')) return 'Teacher Profile';
  if (cleanPath === '/admin/subjects') return 'Subjects';
  if (cleanPath === '/admin/academic-records') return 'Academic Records';
  if (cleanPath === '/admin/risk-analytics') return 'Risk Analytics';
  if (cleanPath === '/admin/reports') return 'Reports';
  if (cleanPath === '/admin/activity-logs') return 'Activity Logs';
  if (cleanPath === '/admin/settings' || cleanPath === '/admin/college-settings') return 'Settings';
  if (cleanPath === '/admin/accounts' || cleanPath === '/admin/active-accounts') return 'Active Accounts';

  // Fallback for any other admin route
  const segment = cleanPath.replace('/admin/', '').split('/')[0];
  if (!segment) return 'Dashboard';
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function AdminLayout({ onLogout, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const currentPageName = getCurrentPageName(location.pathname);

  // Notification Unread Count State
  const [unreadCount, setUnreadCount] = useState(0);

  // Theme Dropdown State
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef(null);

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  // Fetch unread notification count
  const refreshNotifications = useCallback(async () => {
    try {
      const countRes = await adminApi.getUnreadNotificationCount();
      if (countRes && countRes.success) {
        setUnreadCount(countRes.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Could not sync notifications count in header:', err.message);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 25000);
    const handleUpdate = () => refreshNotifications();
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [refreshNotifications, location.pathname]);

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

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { name: 'Manage Students', icon: Users, path: '/admin/students' },
    { name: 'Add Student', icon: UserPlus, path: '/admin/students/create' },
    { name: 'Manage Teachers', icon: GraduationCap, path: '/admin/teachers' },
    { name: 'Add Teacher', icon: UserPlus, path: '/admin/teachers/create' },
    { name: 'Departments & Sections', icon: BookOpen, path: '/admin/classes' },
    { name: 'Subjects', icon: BookOpen, path: '/admin/subjects' },
    { name: 'Academic Records', icon: FileText, path: '/admin/academic-records' },
    { name: 'Risk Analytics', icon: Activity, path: '/admin/risk-analytics' },
    { name: 'Reports', icon: FileText, path: '/admin/reports' },
    { name: 'Activity Logs', icon: FileText, path: '/admin/activity-logs' },
    { name: 'Settings', icon: Settings, path: '/admin/settings' },
    { name: 'My Profile', icon: Users, path: '/admin/profile' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col hidden md:flex transition-colors duration-200 shrink-0">
        <div className="pt-8 pb-6 px-4 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center justify-center mb-3">
            <ClassPulseLogo size="lg" className="hover:scale-105 transition-transform duration-200" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">ClassPulse</h2>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
            Admin Portal
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin/dashboard'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </div>

              {item.hasBadge && unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500 text-white shadow-2xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content Area with Header */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Shared Top Header (Desktop & Mobile) */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3.5 flex justify-between items-center transition-colors duration-200 shrink-0">
          <div className="flex items-center gap-3">
            <ClassPulseLogo size="sm" className="md:hidden shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentPageName}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Task 2: Single Clickable Notifications Navigation Control */}
            <Link
              to="/admin/notifications"
              className={`relative inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                location.pathname === '/admin/notifications'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-2xs font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 min-w-4.5 h-4.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Task 3: Theme Control & Dropdown Selector */}
            <div className="relative" ref={themeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsThemeOpen(prev => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                  isThemeOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-indigo-300 dark:border-indigo-700 shadow-2xs'
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
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isThemeOpen ? 'rotate-180' : ''}`} />
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
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold'
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
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5">
                      <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Dark Mode</span>
                    </div>
                    {theme === 'dark' && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Logout */}
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

        {/* Dynamic Outlet View (Breadcrumbs removed, reclaimed vertical space) */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet context={{ currentUser, onLogout: handleLogout, unreadCount, refreshNotifications }} />
        </div>
      </main>
    </div>
  );
}
