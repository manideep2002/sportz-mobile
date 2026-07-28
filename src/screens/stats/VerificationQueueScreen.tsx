import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';

import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { usePendingVerifications } from '@/hooks/useAthleteStats';
import type { AppStackParamList } from '@/navigation/routes';
import { sportLabelFor } from '@/services/athleteStatsService';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function VerificationQueueScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const { data: items = [], isLoading, isError, error, isRefetching, refetch } = usePendingVerifications();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Verification Queue</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? <ActivityIndicator color={theme.accent} /> : null}

      {isError ? (
        <View style={styles.empty}>
          <ShieldCheck size={42} color={theme.textMuted} />
          <AppText variant="h4">Could not load queue</AppText>
          <AppText variant="bodyMuted" style={styles.emptyText}>
            {error instanceof Error ? error.message : 'Please try again.'}
          </AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <View style={styles.empty}>
          <ShieldCheck size={42} color={theme.textMuted} />
          <AppText variant="h4">All caught up</AppText>
          <AppText variant="bodyMuted">No pending match verifications.</AppText>
        </View>
      ) : null}

      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`Verify match: ${item.teamName} vs ${item.opponentName}`}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.navigate('VerificationDetail', { matchId: item.id })}
        >
          <View style={styles.topRow}>
            <Badge tone={item.verificationStatus === 'pending' ? 'orange' : 'dark'}>
              {item.verificationStatus.replace('_', ' ').toUpperCase()}
            </Badge>
            <AppText variant="small">{timeAgo(item.createdAt)}</AppText>
          </View>
          <AppText variant="h4">{item.teamName} vs {item.opponentName}</AppText>
          <AppText variant="small">
            {sportLabelFor(item.sport)} &middot; {item.season.label}
          </AppText>
          <View style={styles.athlete}>
            <Avatar initials={(item.athlete.display_name ?? '?').charAt(0).toUpperCase()} uri={item.athlete.avatar_url} size={28} />
            <AppText variant="bodyMuted">@{item.athlete.username}</AppText>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm
  },
  headerSpacer: { width: 40 },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  emptyText: { textAlign: 'center' },
  card: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  athlete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  }
});