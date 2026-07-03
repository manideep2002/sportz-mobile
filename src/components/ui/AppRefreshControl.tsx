import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';

import { colors } from '@/design/tokens';

interface AppRefreshControlProps extends Omit<RefreshControlProps, 'refreshing' | 'onRefresh'> {
  refreshing?: boolean;
  onRefresh: () => Promise<unknown> | unknown;
  minVisibleMs?: number;
}

const DEFAULT_MIN_VISIBLE_MS = 700;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AppRefreshControl({
  refreshing = false,
  onRefresh,
  minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
  ...props
}: AppRefreshControlProps) {
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    const startedAt = Date.now();
    setLocalRefreshing(true);

    void (async () => {
      try {
        await onRefresh();
      } catch {
        // Query-backed screens expose refresh failures through their own error states.
      }

      const remaining = minVisibleMs - (Date.now() - startedAt);
      if (remaining > 0) {
        await wait(remaining);
      }
      if (mountedRef.current) {
        setLocalRefreshing(false);
      }
    })();
  }, [minVisibleMs, onRefresh]);

  return (
    <RefreshControl
      refreshing={refreshing || localRefreshing}
      onRefresh={handleRefresh}
      tintColor={colors.orange[500]}
      colors={[colors.orange[500]]}
      {...props}
    />
  );
}
