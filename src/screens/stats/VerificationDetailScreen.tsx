import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ChevronLeft, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, IconButton, Screen, Avatar } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useVerificationDetail, useVerifyAthleteMatch } from '@/hooks/useAthleteStats';
import type { AppStackParamList } from '@/navigation/routes';
import { sportLabelFor } from '@/services/athleteStatsService';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'VerificationDetail'>;

export function VerificationDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const { matchId } = route.params;
  const { data: detail, isLoading, isError, error, isRefetching, refetch } = useVerificationDetail(matchId);
  const verifyMutation = useVerifyAthleteMatch();
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<'verified' | 'rejected' | null>(null);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.accent} />
      </Screen>
    );
  }

  if (isError || !detail) {
    return (
      <Screen contentContainerStyle={styles.center}>
        <AppText variant="h4">Could not load match</AppText>
        <AppText variant="bodyMuted">
          {error instanceof Error ? error.message : 'Please try again.'}
        </AppText>
        <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        <Button size="sm" variant="dark" onPress={() => navigation.goBack()}>Go back</Button>
      </Screen>
    );
  }

  const { match, athlete, season, stats, auditLog } = detail;

  const handleVerify = () => {
    if (!decision) return;
    Alert.alert(
      decision === 'verified' ? 'Verify match' : 'Reject match',
      decision === 'verified'
        ? 'This will mark the match as verified and notify the athlete.'
        : `This will reject the match${reason ? ` with reason: ${reason}` : ''} and notify the athlete.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision === 'verified' ? 'Confirm Verify' : 'Confirm Reject',
          style: decision === 'rejected' ? 'destructive' : 'default',
          onPress: () => {
            verifyMutation.mutate(
              { matchId, status: decision, source: 'manual_review', reason: reason || undefined },
              {
                onSuccess: () => {
                  Alert.alert(
                    decision === 'verified' ? 'Match verified' : 'Match rejected',
                    'The athlete has been notified.',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                },
                onError: (err) => {
                  Alert.alert('Action failed', err instanceof Error ? err.message : 'Please try again.');
                }
              }
            );
          }
        }
      ]
    );
  };

  return (
    <Screen
      refreshControl={<AppRefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
          <AppText variant="h3">Review Match</AppText>
          <View style={styles.headerSpacer} />
        </View>

        {/* Athlete info */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.row}>
            <Avatar initials={(athlete.display_name ?? '?').charAt(0).toUpperCase()} uri={athlete.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="h4">{athlete.display_name}</AppText>
              <AppText variant="bodyMuted">@{athlete.username}</AppText>
            </View>
          </View>
        </View>

        {/* Match details */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="h4">{match.teamName} vs {match.opponentName}</AppText>
          <AppText variant="bodyMuted">
            {new Date(`${match.playedOn}T00:00:00`).toLocaleDateString()} &middot; {sportLabelFor(match.sport)} &middot; {season.label}
          </AppText>
          <AppText variant="h3">
            {match.teamScore ?? '—'} – {match.opponentScore ?? '—'} &middot; {match.outcome.replace('_', ' ')}
          </AppText>
          <Badge tone={match.verificationStatus === 'verified' ? 'blue' : match.verificationStatus === 'rejected' ? 'red' : 'dark'}>
            {match.verificationStatus.replace('_', ' ').toUpperCase()}
          </Badge>
        </View>

        {/* Evidence */}
        {match.evidenceUrl ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">Evidence</AppText>
            <Button
              size="sm"
              variant="dark"
              icon={ExternalLink}
              onPress={() => { void Linking.openURL(match.evidenceUrl!); }}
            >
              View evidence
            </Button>
          </View>
        ) : null}

        {/* Stats */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="h4">Stats</AppText>
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.definition.stat_key} style={[styles.statItem, { backgroundColor: theme.surfaceMuted }]}>
                <AppText variant="h4">{stat.value}</AppText>
                <AppText variant="small">{stat.definition.unit ?? stat.definition.label}</AppText>
              </View>
            ))}
          </View>
        </View>

        {/* Audit log */}
        {auditLog.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">History</AppText>
            {auditLog.map((entry) => (
              <View key={entry.id} style={styles.auditEntry}>
                <AppText variant="small">
                  <Badge tone={entry.newStatus === 'verified' ? 'blue' : 'red'}>{entry.newStatus.toUpperCase()}</Badge>
                </AppText>
                <AppText variant="small">{timeAgo(entry.createdAt)}</AppText>
                {entry.reason ? <AppText variant="bodyMuted">{entry.reason}</AppText> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Verify / Reject controls */}
        {match.verificationStatus === 'self_reported' || match.verificationStatus === 'pending' ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">Decision</AppText>
            <TextInput
              accessibilityLabel="Reason for decision"
              placeholder="Optional reason..."
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text, borderColor: theme.border }]}
              value={reason}
              onChangeText={setReason}
            />
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={verifyMutation.isPending}
                  variant={decision === 'verified' ? undefined : 'dark'}
                  onPress={() => { setDecision('verified'); }}
                >
                  {decision === 'verified' ? 'Selected: Verify' : 'Verify'}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={verifyMutation.isPending}
                  variant={decision === 'rejected' ? 'danger' : 'dark'}
                  onPress={() => { setDecision('rejected'); }}
                >
                  {decision === 'rejected' ? 'Selected: Reject' : 'Reject'}
                </Button>
              </View>
            </View>
            {decision ? (
              <Button
                disabled={verifyMutation.isPending}
                onPress={handleVerify}
              >
                {verifyMutation.isPending ? 'Processing...' : `Confirm ${decision === 'verified' ? 'Verify' : 'Reject'}`}
              </Button>
            ) : null}
            {verifyMutation.isError ? (
              <AppText variant="small" style={{ color: theme.danger }}>
                {verifyMutation.error instanceof Error ? verifyMutation.error.message : 'Action failed.'}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  center: { gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm
  },
  headerSpacer: { width: 40 },
  card: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statItem: {
    minWidth: 64,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center'
  },
  auditEntry: { gap: spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: spacing.sm,
    fontSize: 14
  },
  actions: { flexDirection: 'row', gap: spacing.sm }
});