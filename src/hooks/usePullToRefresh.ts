import { useState, useCallback } from 'react';

export const usePullToRefresh = (onRefreshFn?: () => Promise<void> | void) => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (onRefreshFn) {
        await onRefreshFn();
      }
    } catch (err) {
      console.warn('PullToRefresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshFn]);

  const onScroll = useCallback((event: any) => {
    // Optional scroll tracking for pull to refresh
  }, []);

  return {
    refreshing,
    onRefresh,
    onScroll,
  };
};

export default usePullToRefresh;
