import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const RefreshContext = createContext(null);

export function RefreshProvider({ children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  // Store the active page's refresh handler in a ref to avoid stale closures
  const activeHandlerRef = useRef(null);

  // Auto-dismiss refresh error after 4.5 seconds
  useEffect(() => {
    if (!refreshError) return;
    const timer = setTimeout(() => {
      setRefreshError(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [refreshError]);

  // Register an active page's refresh handler; returns an unregister function
  const registerRefreshHandler = useCallback((handler) => {
    activeHandlerRef.current = handler;
    return () => {
      if (activeHandlerRef.current === handler) {
        activeHandlerRef.current = null;
      }
    };
  }, []);

  const isRefreshingRef = useRef(false);

  // Trigger the refresh operation on the currently active page
  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return; // Prevent repeated clicks from triggering overlapping refresh requests

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      if (typeof activeHandlerRef.current === 'function') {
        await activeHandlerRef.current();
      } else {
        // Fallback simulated refresh if page does not require network data fetching
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch (err) {
      console.error('[ClassPulse] Refresh operation failed:', err);
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to refresh page data. Please try again.';
      setRefreshError(message);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  return (
    <RefreshContext.Provider
      value={{
        isRefreshing,
        refreshError,
        setRefreshError,
        registerRefreshHandler,
        triggerRefresh,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
}

/**
 * Hook for pages to easily register their data-fetching logic with the global refresh button.
 * Automatically cleans up on unmount or navigation.
 */
export function usePageRefresh(refreshFn, deps = []) {
  const { registerRefreshHandler } = useRefresh();
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  useEffect(() => {
    if (!refreshFn) return;
    const unregister = registerRefreshHandler(async () => {
      if (typeof fnRef.current === 'function') {
        return await fnRef.current();
      }
    });
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerRefreshHandler, ...deps]);
}
