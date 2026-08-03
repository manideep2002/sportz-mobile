import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

interface QueryStateProps {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  permissionDenied?: boolean;
  stale?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
}

export function QueryState({
  loading = false,
  error,
  empty = false,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  permissionDenied = false,
  stale = false,
  onRetry,
  children
}: QueryStateProps) {
  const { colors: theme } = useAppTheme();
  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>;
  }
  if (error) {
    return (
      <View style={styles.center} accessibilityRole="alert">
        <AppText variant="h4">{permissionDenied ? 'Permission required' : 'Could not load this'}</AppText>
        <AppText variant="bodyMuted" style={styles.message}>
          {permissionDenied ? 'You do not have access to this information.' : error instanceof Error ? error.message : 'Please try again.'}
        </AppText>
        {onRetry ? <Button size="sm" onPress={onRetry}>Retry</Button> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <AppText variant="h4">{emptyTitle}</AppText>
        {emptyMessage ? <AppText variant="bodyMuted" style={styles.message}>{emptyMessage}</AppText> : null}
      </View>
    );
  }
  return <>{stale ? <AppText variant="caption" style={[styles.stale, { color: theme.textSubtle }]}>Showing saved data — refresh to update.</AppText> : null}{children}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  message: { textAlign: 'center' },
  stale: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xs }
});
