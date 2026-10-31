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
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import ClassPulseLogo from './ClassPulseLogo';
import { useTheme } from '../context/ThemeContext';
import { adminApi } from '../api';
import HeaderRefreshButton from './HeaderRefreshButton';

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

const isRouteActive = (itemPath, currentPath) => {
  const cleanPath = currentPath.replace(/\/+$/, '');

  if (itemPath === '/admin/dashboard') {
    return cleanPath === '/admin' || cleanPath === '/admin/dashboard';
  }
  if (itemPath === '/admin/students/create') {
    return cleanPath === '/admin/students/create';
  }
  if (itemPath === '/admin/students') {
    return (
      cleanPath === '/admin/students' ||
      (cleanPath.startsWith('/admin/students/') && cleanPath !== '/admin/students/create')
    );
  }
  if (itemPath === '/admin/teachers/create') {
    return cleanPath === '/admin/teachers/create';
  }
  if (itemPath === '/admin/teachers') {
    return (
      cleanPath === '/admin/teachers' ||
      (cleanPath.startsWith('/admin/teachers/') && cleanPath !== '/admin/teachers/create')
    );
  }
  if (itemPath === '/admin/classes') {
    return (
      cleanPath === '/admin/classes' ||
      cleanPath.startsWith('/admin/classes/') ||
      cleanPath === '/admin/assignments'
    );
  }
  if (itemPath === '/admin/settings') {
    return (
      cleanPath === '/admin/settings' ||
      cleanPath.startsWith('/admin/settings/') ||
      cleanPath === '/admin/college-settings'
    );
  }
  return cleanPath === itemPath || cleanPath.startsWith(itemPath + '/');
};

export default function AdminLayout({ onLogout, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const currentPageName = getCurrentPageName(location.pathname);

  // Mobile sidebar drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Notification Unread Count State
  const [unreadCount, setUnreadCount] = useState(0);

  // Theme Dropdown State
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef(null);

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const renderNavLinks = (closeMobile = false) => (
    <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
      {menuItems.map((item) => {
        const isActive = isRouteActive(item.path, location.pathname);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => {
              if (closeMobile) setMobileMenuOpen(false);
            }}
            className={() =>
              `group flex items-center justify-between px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border-l-4 transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border-indigo-600 dark:border-indigo-500 shadow-2xs'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`
            }
          >
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

            {item.hasBadge && unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        );
      })}
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
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">ClassPulse</h2>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
            Admin Portal
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
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    Admin Portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Close Navigation Menu"
                aria-label="Close Navigation Menu"
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
                <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content Area with Header */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Shared Top Header (Desktop & Mobile) */}
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
            {/* 1. Global Refresh Button */}
            <HeaderRefreshButton portal="admin" />

            {/* 2. Top-Header Notifications Navigation Control */}
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
