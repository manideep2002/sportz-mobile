import { useState, useCallback } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ChevronLeft, ShieldAlert, ShieldCheck, Trash2, UserX } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import {
  moderationService,
  type EnforcementAction,
  type ReportDetail,
  type EntityPreview,
  type ReporterProfile
} from '@/services/moderationService';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'ModerationDetail'>;

const entityLabel: Record<string, string> = {
  user: 'User',
  post: 'Post',
  comment: 'Comment',
  event: 'Event',
  community: 'Community',
  group: 'Group',
  page: 'Page',
  team_offer: 'Team Offer'
};

const actionLabel: Record<string, string> = {
  dismissed: 'Dismissed',
  removed_content: 'Content Removed',
  restricted_account: 'Account Restricted'
};

const actionIcon: Record<string, typeof ShieldCheck> = {
  dismissed: ShieldCheck,
  removed_content: Trash2,
  restricted_account: UserX
};

export function ModerationDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const queryClient = useQueryClient();
  const route = useRoute<Route>();

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    data: detail,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ['moderation-detail', route.params.reportId],
    queryFn: () => moderationService.getReportDetail(route.params.reportId)
  });

  const {
    data: entityPreview,
    isLoading: previewLoading
  } = useQuery({
    queryKey: ['entity-preview', detail?.entityType, detail?.entityId],
    queryFn: () =>
      moderationService.getEntityPreview(detail!.entityType, detail!.entityId),
    enabled: Boolean(detail)
  });

  const {
    data: reporterProfile
  } = useQuery({
    queryKey: ['reporter-profile', detail?.reporterId],
    queryFn: () =>
      moderationService.getReporterProfile(detail!.reporterId),
    enabled: Boolean(detail)
  });

  // ── Reason input modal ────────────────────────────────────────────────────
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<EnforcementAction | null>(null);
  const [reasonText, setReasonText] = useState('');

  const openActionModal = useCallback((action: EnforcementAction) => {
    setPendingAction(action);
    setReasonText('');
    setActionModalOpen(true);
  }, []);

  const closeActionModal = useCallback(() => {
    setActionModalOpen(false);
    setPendingAction(null);
    setReasonText('');
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const dismissMutation = useMutation({
    mutationFn: (reason: string) =>
      moderationService.dismissReport(route.params.reportId, reason),
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert('Action failed', result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['moderation-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      Alert.alert('Report dismissed', 'The report has been dismissed with no enforcement action.');
      closeActionModal();
    },
    onError: (err) => {
      Alert.alert('Action failed', err instanceof Error ? err.message : 'Please try again.');
    }
  });

  const removeContentMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!detail) throw new Error('No report detail');
      return moderationService.removeContent(
        route.params.reportId,
        detail.entityType,
        detail.entityId,
        reason
      );
    },
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert('Action failed', result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['moderation-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      void queryClient.invalidateQueries({ queryKey: ['entity-preview'] });
      Alert.alert('Content removed', 'The reported content has been removed.');
      closeActionModal();
    },
    onError: (err) => {
      Alert.alert('Action failed', err instanceof Error ? err.message : 'Please try again.');
    }
  });

  const restrictMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!detail) throw new Error('No report detail');
      const targetId = detail.entityType === 'user' ? detail.entityId : entityPreview?.authorId;
      if (!targetId) throw new Error('Could not determine target user for restriction.');
      return moderationService.restrictAccount(route.params.reportId, targetId, reason);
    },
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert('Action failed', result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['moderation-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      void queryClient.invalidateQueries({ queryKey: ['entity-preview'] });
      Alert.alert('Account restricted', 'The user account has been restricted.');
      closeActionModal();
    },
    onError: (err) => {
      Alert.alert('Action failed', err instanceof Error ? err.message : 'Please try again.');
    }
  });

  const confirmAction = () => {
    if (!pendingAction || !reasonText.trim()) return;
    switch (pendingAction) {
      case 'dismissed':
        dismissMutation.mutate(reasonText.trim());
        break;
      case 'removed_content':
        removeContentMutation.mutate(reasonText.trim());
        break;
      case 'restricted_account':
        restrictMutation.mutate(reasonText.trim());
        break;
    }
  };

  const isPending =
    dismissMutation.isPending ||
    removeContentMutation.isPending ||
    restrictMutation.isPending;

  // ── Permissions helpers ───────────────────────────────────────────────
  const canRemoveContent = detail && (detail.entityType === 'post' || detail.entityType === 'comment');
  const canRestrictAccount = detail && (detail.entityType === 'user' || (entityPreview?.authorId != null));

  // ── Render ──────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.centred}>
          <ShieldAlert size={48} color={theme.danger} />
          <AppText variant="h4">Could not load report</AppText>
          <AppText variant="bodyMuted" style={styles.centredText}>
            {error instanceof Error ? error.message : 'Please try again.'}
          </AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          <Button size="sm" variant="ghost" onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      );
    }

    if (!detail) {
      return (
        <View style={styles.centred}>
          <ShieldAlert size={48} color={theme.textMuted} />
          <AppText variant="h4">Report not found</AppText>
          <AppText variant="bodyMuted" style={styles.centredText}>This report may have been deleted.</AppText>
          <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      );
    }

    const isResolved = detail.status !== 'open';

    return (
      <>
        {/* ── Report header ─────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.reportHeader}>
            <Badge tone={detail.status === 'open' ? 'orange' : 'dark'}>{detail.status}</Badge>
            <AppText variant="small">{timeAgo(detail.createdAt)}</AppText>
          </View>
          <AppText style={styles.reason}>{detail.reason}</AppText>
          <AppText variant="bodyMuted">
            {entityLabel[detail.entityType] ?? detail.entityType} &middot; {detail.entityId}
          </AppText>

          {/* Reporter info */}
          {reporterProfile ? (
            <View style={styles.reporterRow}>
              <AppText variant="bodyMuted" style={styles.reporterLabel}>Reported by</AppText>
              <AppText style={styles.reporterName}>@{reporterProfile.username}</AppText>
            </View>
          ) : null}
        </View>

        {/* ── Entity preview ────────────────────────────────────────────── */}
        {entityPreview && Object.keys(entityPreview).length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText style={styles.sectionTitle}>Reported {entityLabel[detail.entityType] ?? 'Content'}</AppText>
            {'body' in entityPreview && typeof entityPreview.body === 'string' ? (
              <AppText variant="bodyMuted" style={styles.previewBody}>
                {entityPreview.removedByModerator ? '[removed by moderator]' : entityPreview.body}
              </AppText>
            ) : null}
            {'displayName' in entityPreview && typeof entityPreview.displayName === 'string' ? (
              <View style={styles.previewUser}>
                <AppText variant="h4">{entityPreview.displayName}</AppText>
                {entityPreview.isRestricted ? <Badge tone="red">Restricted</Badge> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Audit log ─────────────────────────────────────────────────── */}
        {detail.auditLog.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText style={styles.sectionTitle}>Audit Trail</AppText>
            {detail.auditLog.map((entry) => {
              const Icon = actionIcon[entry.action] ?? ShieldCheck;
              return (
                <View key={entry.id} style={[styles.auditRow, { borderBottomColor: theme.border }]}>
                  <Icon size={18} color={entry.action === 'dismissed' ? theme.accent : theme.danger} />
                  <View style={styles.auditMeta}>
                    <AppText style={styles.auditAction}>{actionLabel[entry.action] ?? entry.action}</AppText>
                    <AppText variant="small">{entry.reason}</AppText>
                    <AppText variant="small" style={styles.auditDate}>{timeAgo(entry.createdAt)}</AppText>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── Enforcement actions ───────────────────────────────────────── */}
        {isResolved ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.resolvedBanner}>
              <ShieldCheck size={22} color={theme.accent} />
              <AppText variant="bodyMuted">This report has been resolved.</AppText>
            </View>
            {detail.resolution ? (
              <AppText variant="bodyMuted" style={styles.resolutionText}>{detail.resolution}</AppText>
            ) : null}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText style={styles.sectionTitle}>Enforcement Actions</AppText>
            <AppText variant="bodyMuted" style={styles.actionHint}>
              Choose an action to take on this report.
            </AppText>

            <View style={styles.actionList}>
              {/* Dismiss */}
              <Button
                full
                size="lg"
                variant="dark"
                loading={isPending}
                disabled={isPending}
                onPress={() => openActionModal('dismissed')}
              >
                Dismiss Report
              </Button>

              {/* Remove content (posts and comments only) */}
              {canRemoveContent ? (
                <Button
                  full
                  size="lg"
                  variant="danger"
                  loading={isPending}
                  disabled={isPending}
                  onPress={() => {
                    Alert.alert(
                      'Remove content',
                      'This will replace the reported content with a moderator removal notice. Continue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => openActionModal('removed_content') }
                      ]
                    );
                  }}
                >
                  Remove Content
                </Button>
              ) : null}

              {/* Restrict account (user reports or entity with author) */}
              {canRestrictAccount ? (
                <Button
                  full
                  size="lg"
                  variant="danger"
                  loading={isPending}
                  disabled={isPending}
                  onPress={() => {
                    Alert.alert(
                      'Restrict account',
                      'This will restrict the user account, limiting their ability to use the platform. Continue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Restrict', style: 'destructive', onPress: () => openActionModal('restricted_account') }
                      ]
                    );
                  }}
                >
                  Restrict Account
                </Button>
              ) : null}
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Review Report</AppText>
        <View style={{ width: 40 }} />
      </View>

      {renderBody()}

      {/* ── Reason input modal ──────────────────────────────────────────── */}
      {actionModalOpen ? (
        <View style={[StyleSheet.absoluteFill, styles.modalBackdrop]}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <AppText variant="h4">
              {pendingAction === 'dismissed' ? 'Dismiss Report' :
               pendingAction === 'removed_content' ? 'Remove Content' :
               'Restrict Account'}
            </AppText>
            <AppText variant="bodyMuted" style={styles.modalHint}>
              Provide a reason for this action (visible in audit trail).
            </AppText>
            <TextInput
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Enter reason..."
              placeholderTextColor={theme.textSubtle}
              multiline
              style={[
                styles.reasonInput,
                {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border
                }
              ]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                full
                size="lg"
                variant={pendingAction === 'dismissed' ? 'primary' : 'danger'}
                disabled={!reasonText.trim() || isPending}
                loading={isPending}
                onPress={confirmAction}
              >
                Confirm
              </Button>
              <Button full size="lg" variant="ghost" disabled={isPending} onPress={closeActionModal}>
                Cancel
              </Button>
            </View>
          </Pressable>
        </View>
      ) : null}
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
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  centredText: {
    textAlign: 'center',
    maxWidth: 280
  },
  card: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  reason: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 16
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  reporterLabel: {
    fontSize: 12
  },
  reporterName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  },
  sectionTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    marginBottom: spacing.xs
  },
  previewBody: {
    lineHeight: 20
  },
  previewUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  auditMeta: {
    flex: 1,
    gap: 2
  },
  auditAction: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  },
  auditDate: {
    color: colors.text.tertiary
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  resolutionText: {
    fontStyle: 'italic'
  },
  actionHint: {
    marginBottom: spacing.xs
  },
  actionList: {
    gap: spacing.sm
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlays.scrim,
    justifyContent: 'center',
    padding: spacing.screen
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md
  },
  modalHint: {
    marginTop: -4
  },
  reasonInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top'
  },
  modalActions: {
    gap: spacing.sm
  }
});