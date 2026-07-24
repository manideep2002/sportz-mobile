import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';

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
  tintColor,
  colors: indicatorColors,
  progressBackgroundColor,
  enabled = true,
  size,
  ...props
}: AppRefreshControlProps) {
  const { colors: theme } = useAppTheme();
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
      tintColor={tintColor ?? theme.accent}
      titleColor={tintColor ?? theme.accent}
      colors={indicatorColors ?? [theme.accent, theme.onAccent]}
      progressBackgroundColor={progressBackgroundColor ?? theme.surface}
      progressViewOffset={indicatorOffset}
      size={size}
      {...props}
    />
  );
}
