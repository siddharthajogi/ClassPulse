import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi } from '../api';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  Filter, 
  ShieldCheck, 
  GraduationCap, 
  BookOpen, 
  Mail, 
  KeyRound, 
  UserX, 
  ExternalLink, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';

export default function ActiveAccountsList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'teacher' | 'student'
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Reset Password Modal State
  const [resetModalAccount, setResetModalAccount] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState('');

  // Deactivate Modal State
  const [deactivateAccount, setDeactivateAccount] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getActiveAccounts();
      if (res && res.success) {
        setAccounts(res.accounts || []);
      } else {
        setError(res?.error || 'Failed to load active accounts.');
      }
    } catch (err) {
      console.error('Failed to fetch active accounts:', err);
      setError(err.response?.data?.error || err.message || 'Failed to connect to accounts service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Filter accounts by search term and role
  const filteredAccounts = accounts.filter(acc => {
    const matchesRole = roleFilter === 'all' || acc.role === roleFilter;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return matchesRole;

    const nameMatches = acc.name && acc.name.toLowerCase().includes(term);
    const userIdMatches = acc.userId && acc.userId.toLowerCase().includes(term);
    const emailMatches = acc.email && acc.email.toLowerCase().includes(term);
    const deptMatches = acc.department && acc.department.toLowerCase().includes(term);

    return matchesRole && (nameMatches || userIdMatches || emailMatches || deptMatches);
  });

  const handleDeactivate = async () => {
    if (!deactivateAccount) return;
    setDeactivating(true);
    setDeactivateError('');
    try {
      const res = await adminApi.updateUserStatus(deactivateAccount._id, false);
      if (res.success) {
        setActionSuccess(`Account "${deactivateAccount.userId}" has been deactivated.`);
        setDeactivateAccount(null);
        await fetchAccounts();
        setTimeout(() => setActionSuccess(''), 4000);
      } else {
        setDeactivateError(res.error || 'Failed to deactivate account.');
      }
    } catch (err) {
      setDeactivateError(err.response?.data?.error || err.message || 'Failed to deactivate account.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalAccount) return;
    setResetModalError('');

    if (!newPassword || newPassword.length < 8) {
      setResetModalError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetModalError('Passwords do not match.');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await adminApi.resetUserPassword(resetModalAccount._id, newPassword);
      if (res.success) {
        setActionSuccess(`Password reset successfully for account "${resetModalAccount.userId}".`);
        setResetModalAccount(null);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setActionSuccess(''), 4000);
      } else {
        setResetModalError(res.error || 'Failed to reset password.');
      }
    } catch (err) {
      setResetModalError(err.response?.data?.error || err.message || 'Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <GraduationCap className="w-3.5 h-3.5" />
            Teacher
          </span>
        );
      case 'student':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
            <BookOpen className="w-3.5 h-3.5" />
            Student
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Return to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Active Accounts
              </h1>
              {!loading && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {accounts.length} Active
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Canonical list of all currently enabled accounts across Administrator, Teacher, and Student roles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Refresh Account List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/admin/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-2 p-4 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 p-4 text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, login ID, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full md:w-44 py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Roles ({accounts.length})</option>
              <option value="admin">Admins ({accounts.filter(a => a.role === 'admin' || a.role === 'superadmin').length})</option>
              <option value="teacher">Teachers ({accounts.filter(a => a.role === 'teacher').length})</option>
              <option value="student">Students ({accounts.filter(a => a.role === 'student').length})</option>
            </select>
          </div>

          {(searchTerm || roleFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('all');
              }}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-medium">Loading active accounts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{error}</p>
            <button
              onClick={fetchAccounts}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            {searchTerm || roleFilter !== 'all' ? (
              <>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No active accounts match your search</p>
                <p className="text-xs text-slate-400 mt-1">Try refining your search keyword or resetting the role filter.</p>
                <button
                  onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
                  className="mt-4 px-3.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No active accounts found</p>
                <p className="text-xs text-slate-400 mt-1">There are no enabled accounts registered in this institution.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Account Name</th>
                  <th className="py-3.5 px-6">Login ID</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Email</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredAccounts.map((account) => {
                  return (
                    <tr 
                      key={account._id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Account Name */}
                      <td className="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            account.role === 'admin' || account.role === 'superadmin'
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                              : account.role === 'teacher'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                              : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                          }`}>
                            {account.name ? account.name.charAt(0).toUpperCase() : account.userId.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {account.name || account.userId}
                            </div>
                            {account.department && (
                              <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                                {account.department}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Login ID */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {account.userId}
                        </span>
                      </td>

                      {/* 3. Role */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {getRoleBadge(account.role)}
                      </td>

                      {/* 4. Email */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-400">
                        {account.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-xs">{account.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* 5. Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-400 animate-pulse"></span>
                          Active
                        </span>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Navigation to Profile / Management */}
                          {account.role === 'student' && account.profileId && (
                            <Link
                              to={`/admin/students/${account.profileId}`}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="View Student Profile"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}

                          {account.role === 'teacher' && account.profileId && (
                            <Link
                              to={`/admin/teachers/${account.profileId}`}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="View Teacher Profile"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}

                          {/* Reset Password */}
                          {account.role !== 'admin' && account.role !== 'superadmin' && (
                            <button
                              onClick={() => {
                                setResetModalAccount(account);
                                setNewPassword('');
                                setConfirmPassword('');
                                setResetModalError('');
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}

                          {/* Deactivate Account */}
                          {account.role !== 'admin' && account.role !== 'superadmin' && (
                            <button
                              onClick={() => {
                                setDeactivateAccount(account);
                                setDeactivateError('');
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Deactivate Account"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with summary */}
        {!loading && !error && accounts.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
            <span>
              Showing {filteredAccounts.length} of {accounts.length} active account{accounts.length === 1 ? '' : 's'}
            </span>
            <span>
              All accounts isolated to this institution
            </span>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Reset Account Password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Account: <span className="font-mono font-medium">{resetModalAccount.userId}</span> ({resetModalAccount.role})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResetModalAccount(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetModalError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {resetModalError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalAccount(null)}
                  disabled={resettingPassword}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  {resettingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{resettingPassword ? 'Resetting...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Account Confirmation Modal */}
      {deactivateAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Deactivate Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This will immediately disable login access for this user.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1.5 mb-4 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Account Name:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{deactivateAccount.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Login ID:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{deactivateAccount.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Role:</span>
                <span className="font-medium capitalize text-slate-900 dark:text-slate-100">{deactivateAccount.role}</span>
              </div>
            </div>

            {deactivateError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {deactivateError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeactivateAccount(null)}
                disabled={deactivating}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {deactivating && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{deactivating ? 'Deactivating...' : 'Confirm Deactivation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
