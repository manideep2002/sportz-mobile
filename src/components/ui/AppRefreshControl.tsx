import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, RefreshControl, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/design/tokens';

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
  progressViewOffset,
  tintColor = colors.orange[500],
  colors: indicatorColors = [colors.orange[500], colors.light[0]],
  progressBackgroundColor = colors.dark[800],
  enabled = true,
  size,
  ...props
}: AppRefreshControlProps) {
  const insets = useSafeAreaInsets();
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const indicatorOffset = progressViewOffset ?? Math.max(insets.top + spacing.md, spacing.xl);

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
      enabled={enabled}
      tintColor={tintColor}
      titleColor={tintColor}
      colors={indicatorColors}
      progressBackgroundColor={progressBackgroundColor}
      progressViewOffset={indicatorOffset}
      size={size}
      {...props}
    />
  );
}
