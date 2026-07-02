import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { ChevronLeft, ShieldAlert } from 'lucide-react-native';

import { AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { reportService, type ReportStatus } from '@/services/reportService';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Filter = 'open' | 'all';

export function ModerationScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('open');
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['moderation-reports', filter],
    queryFn: () => reportService.listReports(filter)
  });
  const updateStatus = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: ReportStatus }) =>
      reportService.updateReportStatus(reportId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
    },
    onError: (error) => {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    }
  });

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Moderation</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <SegmentedControl value={filter} options={['open', 'all']} onChange={setFilter} />

      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}

      {!isLoading && reports.length === 0 ? (
        <View style={styles.empty}>
          <ShieldAlert size={42} color={colors.text.tertiary} />
          <AppText variant="h4">No reports</AppText>
          <AppText variant="bodyMuted">Reports from players will appear here.</AppText>
        </View>
      ) : null}

      {reports.map((report) => (
        <View key={report.id} style={styles.report}>
          <View style={styles.topRow}>
            <Badge tone={report.status === 'open' ? 'orange' : 'dark'}>{report.status}</Badge>
            <AppText variant="small">{timeAgo(report.createdAt)}</AppText>
          </View>
          <AppText style={styles.reason}>{report.reason}</AppText>
          <AppText variant="bodyMuted">{report.entityType} - {report.entityId}</AppText>
          <View style={styles.reporter}>
            <Avatar initials={report.reporter.initials} uri={report.reporter.avatarUrl} size={34} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.reporterName}>{report.reporter.displayName}</AppText>
              <AppText variant="small">@{report.reporter.username}</AppText>
            </View>
          </View>
          {report.status === 'open' ? (
            <View style={styles.actions}>
              <Button size="sm" loading={updateStatus.isPending} onPress={() => updateStatus.mutate({ reportId: report.id, status: 'reviewed' })}>
                Reviewed
              </Button>
              <Button size="sm" variant="ghost" disabled={updateStatus.isPending} onPress={() => updateStatus.mutate({ reportId: report.id, status: 'dismissed' })}>
                Dismiss
              </Button>
              <Button size="sm" variant="danger" disabled={updateStatus.isPending} onPress={() => updateStatus.mutate({ reportId: report.id, status: 'actioned' })}>
                Actioned
              </Button>
            </View>
          ) : null}
        </View>
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
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap'
  }
});
