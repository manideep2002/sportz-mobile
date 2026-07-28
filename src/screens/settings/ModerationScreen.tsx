import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ShieldAlert } from 'lucide-react-native';


import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, VerifiedName } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { reportService } from '@/services/reportService';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Filter = 'open' | 'all';

export function ModerationScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const [filter, setFilter] = useState<Filter>('open');
  const { data: reports = [], isLoading, isError, error, isRefetching, refetch } = useQuery({
    queryKey: ['moderation-reports', filter],
    queryFn: () => reportService.listReports(filter)
  });

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Moderation</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <SegmentedControl value={filter} options={['open', 'all']} onChange={setFilter} />

      {isLoading ? <ActivityIndicator color={theme.accent} /> : null}
      {isError ? (
        <View style={styles.empty}>
          <AppText variant="h4">Could not load reports</AppText>
          <AppText variant="bodyMuted" style={styles.emptyText}>
            {error instanceof Error ? error.message : 'Please try again.'}
          </AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}

      {!isLoading && !isError && reports.length === 0 ? (
        <View style={styles.empty}>
          <ShieldAlert size={42} color={theme.textSubtle} />
          <AppText variant="h4">No reports</AppText>
          <AppText variant="bodyMuted">Reports from players will appear here.</AppText>
        </View>
      ) : null}

{reports.map((report) => (
        <Pressable
          key={report.id}
          accessibilityRole="button"
          accessibilityLabel={`Report: ${report.reason}`}
          style={[styles.report, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.navigate('ModerationDetail', { reportId: report.id })}
        >
          <View style={styles.topRow}>
            <Badge tone={report.status === 'open' ? 'orange' : 'dark'}>{report.status}</Badge>
            <AppText variant="small">{timeAgo(report.createdAt)}</AppText>
          </View>
          <AppText style={styles.reason}>{report.reason}</AppText>
          <AppText variant="bodyMuted">{report.entityType} &middot; {report.entityId}</AppText>
          {report.entityType === 'team_offer' ? (
            <Button
              size="sm"
              variant="dark"
              onPress={() => navigation.navigate('OfferDetail', { offerId: report.entityId })}
            >
              Review Private Offer
            </Button>
          ) : null}
          <View style={styles.reporter}>
            <Avatar initials={report.reporter.initials} uri={report.reporter.avatarUrl} size={34} />
            <View style={{ flex: 1 }}>
              <VerifiedName profile={report.reporter} style={styles.reporterName} numberOfLines={1} />
              <AppText variant="small">@{report.reporter.username}</AppText>
            </View>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerSpacer: {
    width: 40
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  emptyText: {
    textAlign: 'center'
  },
  report: {
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  reason: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 15
  },
  reporter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  reporterName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  }
});
