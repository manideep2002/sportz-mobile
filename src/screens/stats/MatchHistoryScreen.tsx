import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CalendarDays, ChevronLeft, Plus } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, Chip, IconButton, QueryState, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useAthleteMatches, useAthleteSeasons } from '@/hooks/useAthleteStats';
import type { AppStackParamList } from '@/navigation/routes';
import { sportKeyFor, sportLabelFor } from '@/services/athleteStatsService';
import { useAuthStore } from '@/store/authStore';
import type { StructuredSport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'MatchHistory'>;

export function MatchHistoryScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const currentProfile = useAuthStore((state) => state.profile);
  const athleteId = route.params?.userId ?? currentProfile?.id ?? '';
  const isOwn = athleteId === currentProfile?.id;
  const initialSport = route.params?.sport
    ?? sportKeyFor(currentProfile?.primarySport ?? '')
    ?? 'basketball';
  const [sport, setSport] = useState<StructuredSport>(initialSport);
  const seasonsQuery = useAthleteSeasons(athleteId);
  const relevantSeasons = useMemo(
    () => (seasonsQuery.data ?? []).filter((season) => season.sport === sport),
    [seasonsQuery.data, sport]
  );
  const [seasonId, setSeasonId] = useState(route.params?.seasonId ?? '');

  useEffect(() => {
    if (!relevantSeasons.some((season) => season.id === seasonId)) {
      setSeasonId(relevantSeasons[0]?.id ?? '');
    }
  }, [relevantSeasons, seasonId]);

  const matchesQuery = useAthleteMatches(athleteId, seasonId || undefined);
  const availableSports = useMemo(
    () => Array.from(new Set((seasonsQuery.data ?? []).map((season) => season.sport))),
    [seasonsQuery.data]
  );
  const historyError = seasonsQuery.isError || matchesQuery.isError;
  const historyErrorMessage = seasonsQuery.error ?? matchesQuery.error;
  const refetchHistory = () => {
    void matchesQuery.refetch();
    void seasonsQuery.refetch();
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<AppRefreshControl refreshing={matchesQuery.isRefetching || seasonsQuery.isRefetching} onRefresh={refetchHistory} />}
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Match History</AppText>
        {isOwn ? (
          <IconButton icon={Plus} accessibilityLabel="Record match" onPress={() => navigation.navigate('StatsEntry', { sport })} />
        ) : <View style={styles.spacer} />}
      </View>

      {availableSports.length > 1 ? (
        <View style={styles.chips}>
          {availableSports.map((item) => (
            <Chip key={item} selected={sport === item} onPress={() => setSport(item)}>
              {sportLabelFor(item)}
            </Chip>
          ))}
        </View>
      ) : null}
      {relevantSeasons.length > 0 ? (
        <View style={styles.chips}>
          {relevantSeasons.map((season) => (
            <Chip key={season.id} selected={season.id === seasonId} onPress={() => setSeasonId(season.id)}>
              {season.label}
            </Chip>
          ))}
        </View>
      ) : null}

      {seasonsQuery.isLoading || matchesQuery.isLoading ? <ActivityIndicator color={theme.accent} /> : null}
      {historyError ? (
        <QueryState error={historyErrorMessage} onRetry={refetchHistory} />
      ) : null}
      {!matchesQuery.isLoading && !historyError && !(matchesQuery.data ?? []).length ? (
        <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <CalendarDays size={36} color={theme.textSubtle} />
          <AppText variant="h4">No matches recorded</AppText>
          <AppText variant="bodyMuted" style={styles.center}>Match history comes from structured records, not stats posts.</AppText>
          {isOwn ? <Button onPress={() => navigation.navigate('StatsEntry', { sport })}>Record Match</Button> : null}
        </View>
      ) : null}

      {(matchesQuery.data ?? []).map((match) => (
        <View key={match.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.title}>
              <AppText variant="h4">{match.teamName} vs {match.opponentName}</AppText>
              <AppText variant="small">{new Date(`${match.playedOn}T00:00:00`).toLocaleDateString()}</AppText>
            </View>
            <Badge tone={match.verificationStatus === 'verified' ? 'blue' : match.verificationStatus === 'rejected' ? 'red' : 'dark'}>
              {match.verificationStatus.replace('_', ' ').toUpperCase()}
            </Badge>
          </View>
          <AppText variant="h3">
            {match.teamScore ?? '—'} – {match.opponentScore ?? '—'} · {match.outcome.replace('_', ' ')}
          </AppText>
          <View style={styles.stats}>
            {match.stats.map((stat) => (
              <View key={stat.key} style={[styles.stat, { backgroundColor: theme.surfaceMuted }]}>
                <AppText variant="h4">{stat.value}</AppText>
                <AppText variant="small">{stat.unit ?? stat.label}</AppText>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  empty: { padding: spacing.xl, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stat: { minWidth: 64, borderRadius: 10, padding: spacing.sm, alignItems: 'center' }
});

