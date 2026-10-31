import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText,
  Clock,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react';
import { adminApi } from '../api';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { usePageRefresh } from '../context/RefreshContext';

// Format relative date safely
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: Bell },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'teachers', label: 'Teachers', icon: GraduationCap },
  { id: 'departments_sections', label: 'Departments & Sections', icon: BookOpen },
  { id: 'academics', label: 'Academics', icon: FileText },
  { id: 'student_risks', label: 'Student Risks', icon: AlertTriangle },
  { id: 'security_system', label: 'Security & System', icon: ShieldCheck }
];

export default function Notifications() {
  const navigate = useNavigate();

  // State
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filtering & Pagination
  const [statusTab, setStatusTab] = useState('all'); // 'all', 'unread', 'read'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  // Overall Counts
  const [counts, setCounts] = useState({ total: 0, unread: 0, read: 0 });

  // Action Loading tracking
  const [actionInProgress, setActionInProgress] = useState({});

  // Selection & Bulk Action States
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState('');

  // 3-Second Undo & Delayed Deletion States
  const [undoState, setUndoState] = useState(null);
  const pendingDeletionsRef = useRef(new Map());

  // Finalize all pending deletions immediately (flush to DB)
  const finalizePendingDeletions = useCallback(async () => {
    if (pendingDeletionsRef.current.size === 0) return;
    const pendingOps = Array.from(new Set(Array.from(pendingDeletionsRef.current.values())));
    pendingDeletionsRef.current.clear();
    setUndoState(null);

    for (const op of pendingOps) {
      if (op.timerId) clearTimeout(op.timerId);
      try {
        if (op.type === 'single') {
          await adminApi.deleteNotification(op.id);
        } else if (op.type === 'bulk') {
          await adminApi.bulkDeleteNotifications(op.ids);
        }
      } catch (err) {
        console.error('Finalize pending deletion error:', err);
      }
    }
    window.dispatchEvent(new Event('notifications-updated'));
  }, []);

  const fetchNotifications = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const res = await adminApi.getNotifications({
        page: currentPage,
        limit: 10,
        status: statusTab,
        category: selectedCategory
      });

      if (res && res.success) {
        // Exclude any notifications that are currently pending deletion within the 3-second undo window
        const pendingIds = Array.from(pendingDeletionsRef.current.keys());
        const rawList = res.notifications || [];
        const liveList = pendingIds.length > 0
          ? rawList.filter(item => !pendingIds.includes(item._id))
          : rawList;

        setNotifications(liveList);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalFiltered(Math.max(0, (res.pagination.total || 0) - pendingIds.length));
        }
        if (res.counts) {
          let pendingUnread = 0;
          let pendingRead = 0;
          const uniqueOps = Array.from(new Set(Array.from(pendingDeletionsRef.current.values())));
          uniqueOps.forEach(op => {
            if (op.items) {
              op.items.forEach(({ item }) => {
                if (item.isRead) pendingRead++;
                else pendingUnread++;
              });
            }
          });
          setCounts({
            total: Math.max(0, res.counts.total - pendingIds.length),
            unread: Math.max(0, res.counts.unread - pendingUnread),
            read: Math.max(0, res.counts.read - pendingRead)
          });
        }
      } else {
        setError(res?.error || 'Failed to load notifications');
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err?.response?.data?.error || err.message || 'Error connecting to notifications service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, statusTab, selectedCategory]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 1-second countdown ticker for the Undo button
  useEffect(() => {
    if (!undoState) return;
    const interval = setInterval(() => {
      setUndoState(prev => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) return prev;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [undoState?.id, undoState?.count]);

  // Cleanup & safety: flush pending deletions on unmount or beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const pendingIds = Array.from(pendingDeletionsRef.current.keys());
      if (pendingIds.length > 0) {
        try {
          fetch('/api/admin/notifications/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: pendingIds }),
            keepalive: true
          });
        } catch (_) {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      const pendingOps = Array.from(new Set(Array.from(pendingDeletionsRef.current.values())));
      pendingOps.forEach(op => {
        if (op.timerId) clearTimeout(op.timerId);
        if (op.type === 'single') {
          adminApi.deleteNotification(op.id).catch(() => {});
        } else if (op.type === 'bulk') {
          adminApi.bulkDeleteNotifications(op.ids).catch(() => {});
        }
      });
      pendingDeletionsRef.current.clear();
    };
  }, []);

  // Register with global header refresh button
  usePageRefresh(() => fetchNotifications(true), [fetchNotifications]);

  // Clear selections when changing tabs, categories, or pagination
  useEffect(() => {
    setSelectedIds([]);
  }, [statusTab, selectedCategory, currentPage]);

  // Selection computations
  const displayedIds = notifications.map(n => n._id);
  const isAllSelected = displayedIds.length > 0 && displayedIds.every(id => selectedIds.includes(id));
  const selectedUnreadIds = notifications
    .filter(n => selectedIds.includes(n._id) && !n.isRead)
    .map(n => n._id);
  const hasUnreadSelected = selectedUnreadIds.length > 0;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      setSelectedIds([]);
    } else {
      // Select all currently displayed in this filter
      setSelectedIds([...displayedIds]);
    }
  };

  const handleToggleSelectOne = (id, forcedState) => {
    if (!id) return;
    setSelectedIds(prev => {
      const isCurrentlySelected = prev.includes(id);
      const shouldSelect = typeof forcedState === 'boolean' ? forcedState : !isCurrentlySelected;
      if (shouldSelect) {
        return isCurrentlySelected ? prev : [...prev, id];
      } else {
        return isCurrentlySelected ? prev.filter(item => item !== id) : prev;
      }
    });
  };

  // Mark single notification as read
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    setActionInProgress(prev => ({ ...prev, [id]: true }));
    try {
      const res = await adminApi.markNotificationAsRead(id);
      if (res && res.success) {
        setNotifications(prev =>
          prev.map(item => (item._id === id ? { ...item, isRead: true, readAt: new Date() } : item))
        );
        setCounts(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1),
          read: prev.read + 1
        }));
        setSelectedIds(prev => prev.filter(item => item !== id));
        window.dispatchEvent(new Event('notifications-updated'));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setActionInProgress(prev => ({ ...prev, [id]: false }));
    }
  };

  // Bulk Mark as Read: Target only selected notifications that are actually unread
  const handleBulkMarkAsRead = async () => {
    if (bulkActionLoading || !hasUnreadSelected) return;

    const targetIds = [...selectedUnreadIds];
    if (targetIds.length === 0) return;

    setBulkActionLoading(true);
    setError('');
    try {
      const res = await adminApi.bulkMarkNotificationsAsRead(targetIds);
      if (res && res.success) {
        // 1. Immediately update notifications in UI
        if (statusTab === 'unread') {
          // If on 'unread' tab, remove the read notifications immediately from view
          setNotifications(prev => prev.filter(item => !targetIds.includes(item._id)));
          setTotalFiltered(prev => Math.max(0, prev - targetIds.length));
        } else {
          // On 'all' or 'read' tabs, mark them as read locally
          setNotifications(prev =>
            prev.map(item =>
              targetIds.includes(item._id)
                ? { ...item, isRead: true, readAt: new Date() }
                : item
            )
          );
        }

        // 2. Update metric counts accurately (preserve total, decrease unread, increase read)
        const updatedCount = res.updatedCount !== undefined ? res.updatedCount : targetIds.length;
        if (res.counts) {
          setCounts(res.counts);
        } else {
          setCounts(prev => ({
            ...prev,
            unread: Math.max(0, prev.unread - updatedCount),
            read: prev.read + updatedCount
          }));
        }

        // 3. Clear only the successfully processed notifications from selection
        setSelectedIds(prev => prev.filter(id => !targetIds.includes(id)));

        // 4. Show success feedback
        setSuccessMessage(res.message || `${updatedCount} notification${updatedCount > 1 ? 's' : ''} marked as read.`);
        setTimeout(() => setSuccessMessage(''), 3500);

        // 5. Notify header to update unread badge
        window.dispatchEvent(new Event('notifications-updated'));

        // 6. If currently on unread tab, re-fetch server state for accurate pagination
        if (statusTab === 'unread') {
          fetchNotifications(true);
        }
      } else {
        setError(res?.error || 'Failed to mark selected notifications as read.');
      }
    } catch (err) {
      console.error('Failed to mark selected notifications as read:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to mark notifications as read.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete with 3-Second Undo
  const handleConfirmBulkDelete = () => {
    if (bulkActionLoading || selectedIds.length === 0) return;

    const targetIds = [...selectedIds];

    // Finalize any previously pending deletion first
    finalizePendingDeletions();

    const itemsToDelete = notifications
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => targetIds.includes(item._id));

    setIsDeleteModalOpen(false);
    setDeleteModalError('');
    setSelectedIds([]);

    // 1. Remove from visible list immediately
    setNotifications(prev => prev.filter(n => !targetIds.includes(n._id)));

    let unreadCount = 0;
    let readCount = 0;
    itemsToDelete.forEach(({ item }) => {
      if (item.isRead) readCount++;
      else unreadCount++;
    });

    // 2. Optimistically adjust counts
    setCounts(prev => ({
      total: Math.max(0, prev.total - targetIds.length),
      unread: Math.max(0, prev.unread - unreadCount),
      read: Math.max(0, prev.read - readCount)
    }));
    setTotalFiltered(prev => Math.max(0, prev - targetIds.length));

    // 3. Register pending deletion
    const bulkData = {
      type: 'bulk',
      ids: targetIds,
      items: itemsToDelete,
      unreadCount,
      readCount
    };
    targetIds.forEach(id => pendingDeletionsRef.current.set(id, bulkData));

    // 4. Set 3-second timer for permanent DB deletion
    const timerId = setTimeout(async () => {
      await commitBulkDeletion(targetIds, itemsToDelete, unreadCount, readCount);
    }, 3000);
    bulkData.timerId = timerId;

    // 5. Display 3-second Undo notification
    setUndoState({
      type: 'bulk',
      ids: targetIds,
      count: targetIds.length,
      message: `${targetIds.length} notification${targetIds.length > 1 ? 's' : ''} deleted.`,
      items: itemsToDelete,
      unreadCount,
      readCount,
      timerId,
      secondsLeft: 3
    });
  };

  const commitBulkDeletion = async (targetIds, itemsToDelete, unreadCount, readCount) => {
    setUndoState(prev => (prev?.type === 'bulk' && prev?.ids === targetIds ? null : prev));
    targetIds.forEach(id => pendingDeletionsRef.current.delete(id));

    try {
      const res = await adminApi.bulkDeleteNotifications(targetIds);
      if (res && res.success) {
        window.dispatchEvent(new Event('notifications-updated'));
      } else {
        throw new Error(res?.error || 'Bulk deletion failed');
      }
    } catch (err) {
      console.error('Permanent bulk deletion failed:', err);
      // Restore notifications on failure
      setNotifications(prev => {
        const next = [...prev];
        itemsToDelete
          .sort((a, b) => a.originalIndex - b.originalIndex)
          .forEach(({ item, originalIndex }) => {
            if (!next.some(n => n._id === item._id)) {
              const insertIdx = Math.min(originalIndex, next.length);
              next.splice(insertIdx, 0, item);
            }
          });
        return next;
      });
      setCounts(prev => ({
        total: prev.total + targetIds.length,
        unread: prev.unread + unreadCount,
        read: prev.read + readCount
      }));
      setTotalFiltered(prev => prev + targetIds.length);
      setError('Failed to permanently delete notifications. Items restored.');
    }
  };

  // Delete single notification with 3-second Undo
  const handleDeleteOne = (item, e) => {
    if (e) e.stopPropagation();

    // Finalize any previously pending deletion first
    finalizePendingDeletions();

    const id = item._id;
    const originalIndex = notifications.findIndex(n => n._id === id);
    const wasRead = item.isRead;

    // 1. Remove from visible list and active selections immediately
    setNotifications(prev => prev.filter(n => n._id !== id));
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));

    // 2. Optimistically adjust counts
    setCounts(prev => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      unread: !wasRead ? Math.max(0, prev.unread - 1) : prev.unread,
      read: wasRead ? Math.max(0, prev.read - 1) : prev.read
    }));
    setTotalFiltered(prev => Math.max(0, prev - 1));

    // 3. Register pending deletion
    const singleData = {
      type: 'single',
      id,
      items: [{ item, originalIndex: originalIndex >= 0 ? originalIndex : 0 }],
      wasRead
    };
    pendingDeletionsRef.current.set(id, singleData);

    // 4. Set 3-second timer for permanent DB deletion
    const timerId = setTimeout(async () => {
      await commitSingleDeletion(id, item, originalIndex, wasRead);
    }, 3000);
    singleData.timerId = timerId;

    // 5. Display 3-second Undo notification
    setUndoState({
      type: 'single',
      id,
      title: item.title,
      message: 'Notification deleted.',
      items: [{ item, originalIndex: originalIndex >= 0 ? originalIndex : 0 }],
      wasRead,
      timerId,
      secondsLeft: 3
    });
  };

  const commitSingleDeletion = async (id, item, originalIndex, wasRead) => {
    setUndoState(prev => (prev?.id === id ? null : prev));
    pendingDeletionsRef.current.delete(id);

    try {
      const res = await adminApi.deleteNotification(id);
      if (res && res.success) {
        window.dispatchEvent(new Event('notifications-updated'));
      } else {
        throw new Error(res?.error || 'Permanent deletion failed');
      }
    } catch (err) {
      console.error('Failed to permanently delete notification:', err);
      // Restore on failure
      setNotifications(prev => {
        if (prev.some(n => n._id === item._id)) return prev;
        const next = [...prev];
        const insertIdx = Math.min(originalIndex >= 0 ? originalIndex : 0, next.length);
        next.splice(insertIdx, 0, item);
        return next;
      });
      setCounts(prev => ({
        ...prev,
        total: prev.total + 1,
        unread: !wasRead ? prev.unread + 1 : prev.unread,
        read: wasRead ? prev.read + 1 : prev.read
      }));
      setTotalFiltered(prev => prev + 1);
      setError(`Failed to permanently delete "${item.title}". Notification restored.`);
    }
  };

  // Undo deletion handler
  const handleUndo = () => {
    if (!undoState) return;

    if (undoState.timerId) {
      clearTimeout(undoState.timerId);
    }

    const itemsToRestore = undoState.items || [];
    setNotifications(prev => {
      const next = [...prev];
      itemsToRestore
        .sort((a, b) => a.originalIndex - b.originalIndex)
        .forEach(({ item, originalIndex }) => {
          if (!next.some(n => n._id === item._id)) {
            const insertIdx = Math.min(originalIndex, next.length);
            next.splice(insertIdx, 0, item);
          }
        });
      return next;
    });

    if (undoState.type === 'single') {
      pendingDeletionsRef.current.delete(undoState.id);
      setCounts(prev => ({
        ...prev,
        total: prev.total + 1,
        unread: !undoState.wasRead ? prev.unread + 1 : prev.unread,
        read: undoState.wasRead ? prev.read + 1 : prev.read
      }));
      setTotalFiltered(prev => prev + 1);
    } else if (undoState.type === 'bulk') {
      (undoState.ids || []).forEach(id => pendingDeletionsRef.current.delete(id));
      setCounts(prev => ({
        total: prev.total + (undoState.count || 0),
        unread: prev.unread + (undoState.unreadCount || 0),
        read: prev.read + (undoState.readCount || 0)
      }));
      setTotalFiltered(prev => prev + (undoState.count || 0));
    }

    setUndoState(null);
    setSuccessMessage('Deletion undone. Notification restored.');
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  // Handle card click
  const handleNotificationClick = async (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }
    if (item.destinationUrl) {
      navigate(item.destinationUrl);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Critical',
          badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
          dotClass: 'bg-rose-500'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'Warning',
          badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
          dotClass: 'bg-amber-500'
        };
      case 'success':
        return {
          icon: CheckCircle2,
          label: 'Success',
          badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
          dotClass: 'bg-emerald-500'
        };
      default:
        return {
          icon: Info,
          label: 'Info',
          badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
          dotClass: 'bg-blue-500'
        };
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'students': return 'Students';
      case 'teachers': return 'Teachers';
      case 'departments_sections': return 'Departments & Sections';
      case 'academics': return 'Academics';
      case 'student_risks': return 'Student Risks';
      case 'security_system': return 'Security & System';
      default: return category;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      
      {/* 1. Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 min-h-[105px] border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Notifications</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{counts.total}</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 min-h-[105px] border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Unread Alerts</p>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{counts.unread}</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 min-h-[105px] border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Read & Acknowledged</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{counts.read}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-2 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchNotifications(false)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Filter Navigation (Tabs, Category Filters, & Select All) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Status Tabs (Top-Left) */}
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => { setStatusTab('all'); setCurrentPage(1); }}
              type="button"
              className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setStatusTab('unread'); setCurrentPage(1); }}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusTab === 'unread'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>Unread</span>
              {counts.unread > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {counts.unread}
                </span>
              )}
            </button>
            <button
              onClick={() => { setStatusTab('read'); setCurrentPage(1); }}
              type="button"
              className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusTab === 'read'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Read
            </button>
          </div>
        </div>

        {/* Category Pills & Bottom-Right Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          {/* Category Filter Buttons (Left) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1 min-w-0">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setCurrentPage(1); }}
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom-Right Corner Action Controls (Bulk Actions + Select All Button) */}
          <div className="flex items-center flex-wrap gap-2 shrink-0 self-end sm:self-center">
            {/* Bulk Action Buttons: Shown only when 1 or more notifications are selected */}
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={handleBulkMarkAsRead}
                  disabled={bulkActionLoading || !hasUnreadSelected}
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs ${
                    !hasUnreadSelected || bulkActionLoading
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  }`}
                  title={
                    !hasUnreadSelected
                      ? 'No selected notifications are unread'
                      : `Mark ${selectedUnreadIds.length} notification${selectedUnreadIds.length > 1 ? 's' : ''} as read`
                  }
                >
                  {bulkActionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Mark as Read{hasUnreadSelected ? ` (${selectedUnreadIds.length})` : ''}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setDeleteModalError('');
                    setIsDeleteModalOpen(true);
                  }}
                  disabled={bulkActionLoading}
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed"
                  title="Delete selected notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedIds.length})</span>
                </button>
              </>
            )}

            {/* Select All / Deselect All Button */}
            <button
              onClick={handleToggleSelectAll}
              disabled={loading || notifications.length === 0}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed whitespace-nowrap"
              title={isAllSelected ? "Deselect all displayed notifications" : "Select all displayed notifications"}
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Select All</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Notifications List */}
      <div className="space-y-3.5 sm:space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No notifications found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {statusTab === 'unread'
                ? "You're all caught up! No unread notifications require your attention."
                : 'No notifications match the current filters. Notifications are generated in real-time as administrative events occur.'}
            </p>
          </div>
        ) : (
          notifications.map((item) => {
            const severityInfo = getSeverityBadge(item.severity);
            const SeverityIcon = severityInfo.icon;
            const isItemLoading = actionInProgress[item._id];
            const isSelected = selectedIds.includes(item._id);

            return (
              <div
                key={item._id}
                onClick={() => handleNotificationClick(item)}
                className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-4.5 sm:p-5 sm:p-6 border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30 dark:ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/30 shadow-xs'
                    : !item.isRead
                    ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Card Checkbox */}
                  <label
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="pt-1.5 shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSelectOne(item._id, e.target.checked);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer transition-colors"
                      aria-label={`Select notification ${item.title}`}
                    />
                  </label>

                  {/* Left Icon with unread ping indicator */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`p-2.5 rounded-xl border ${severityInfo.badgeClass}`}>
                      <SeverityIcon className="w-5 h-5" />
                    </div>
                    {!item.isRead && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${severityInfo.badgeClass}`}>
                        {severityInfo.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {getCategoryLabel(item.category)}
                      </span>
                      {!item.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(item._id, e)}
                          disabled={isItemLoading || bulkActionLoading}
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-50 text-[11px] font-medium"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>

                    <h3 className={`text-sm sm:text-base font-bold ${
                      !item.isRead 
                        ? 'text-slate-900 dark:text-slate-100' 
                        : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Right-aligned Vertical Stack:
                      1. Date and time (first)
                      2. Open Destination (immediately below date)
                      3. Delete (immediately below Open Destination)
                  */}
                  <div className="flex flex-col items-end shrink-0 gap-1.5 text-xs pt-0.5">
                    {/* 1. Date and time (first) */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatRelativeTime(item.createdAt)}</span>
                    </div>

                    {/* 2. Open Destination (immediately below date) */}
                    {item.destinationUrl && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationClick(item);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer whitespace-nowrap py-0.5"
                        title="Open destination"
                      >
                        <span>Open Destination</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* 3. Delete (immediately below Open Destination) */}
                    <button
                      onClick={(e) => handleDeleteOne(item, e)}
                      disabled={isItemLoading || bulkActionLoading}
                      type="button"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap font-medium"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing Page <span className="font-semibold text-slate-800 dark:text-slate-200">{currentPage}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span> ({totalFiltered} total filtered)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || loading || bulkActionLoading}
              type="button"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || loading || bulkActionLoading}
              type="button"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal for Bulk Deletion */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!bulkActionLoading) {
            setIsDeleteModalOpen(false);
            setDeleteModalError('');
          }
        }}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${selectedIds.length} Notification${selectedIds.length > 1 ? 's' : ''}?`}
        message={`Are you sure you want to delete the ${selectedIds.length} selected notification${selectedIds.length > 1 ? 's' : ''}? You will have 3 seconds to undo this action.`}
        confirmText="Delete Selected"
        loading={bulkActionLoading}
        error={deleteModalError}
      />

      {/* 7. 3-Second Floating Undo Banner / Toast */}
      {undoState && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3.5 px-4.5 py-3 bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">
              {undoState.message}
            </span>
          </div>
          <button
            onClick={handleUndo}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Undo deletion within 3 seconds"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo ({undoState.secondsLeft}s)</span>
          </button>
        </div>
      )}

    </div>
  );
}
