import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, History, Plus } from 'lucide-react-native';

import { AppText, Badge, Button, Chip, QueryState, StatCard } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useAthleteSeasons, useAthleteStatSummary } from '@/hooks/useAthleteStats';
import type { AppStackParamList } from '@/navigation/routes';
import { sportKeyFor, sportLabelFor } from '@/services/athleteStatsService';
import { useAuthStore } from '@/store/authStore';
import type { StructuredSport, UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const metricValue = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');

interface StructuredStatsPanelProps {
  profile: UserProfile;
  selectedSport?: StructuredSport;
  onSelectSport?: (sport: StructuredSport) => void;
}

export function StructuredStatsPanel({
  profile,
  selectedSport,
  onSelectSport
}: StructuredStatsPanelProps) {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isOwnProfile = currentUserId === profile.id;
  const profileSports = useMemo(
    () => Array.from(new Set([profile.primarySport, ...profile.sports]
      .map(sportKeyFor)
      .filter((sport): sport is StructuredSport => Boolean(sport)))),
    [profile.primarySport, profile.sports]
  );
  const [internalSport, setInternalSport] = useState<StructuredSport | undefined>(profileSports[0]);

  const activeSport = selectedSport && profileSports.includes(selectedSport)
    ? selectedSport
    : internalSport;

  const handleSelectSport = (nextSport: StructuredSport) => {
    setInternalSport(nextSport);
    onSelectSport?.(nextSport);
  };

  useEffect(() => {
    if (!activeSport || !profileSports.includes(activeSport)) {
      if (profileSports[0]) handleSelectSport(profileSports[0]);
    }
  }, [profileSports, activeSport]);

  const seasonsQuery = useAthleteSeasons(profile.id, activeSport);
  const [seasonId, setSeasonId] = useState<string | undefined>();

  useEffect(() => {
    if (!seasonsQuery.data?.length) {
      setSeasonId(undefined);
      return;
    }
    if (!seasonId || !seasonsQuery.data.some((season) => season.id === seasonId)) {
      setSeasonId(seasonsQuery.data[0].id);
    }
  }, [seasonId, seasonsQuery.data]);

  const summaryQuery = useAthleteStatSummary(profile.id, activeSport ?? 'basketball', seasonId);

  if (!activeSport) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="h4">Structured Statistics</AppText>
        <AppText variant="bodyMuted">
          Structured match statistics are available for all supported sports.
        </AppText>
        {isOwnProfile ? (
          <Button icon={Plus} onPress={() => navigation.navigate('StatsEntry')}>Record Match</Button>
        ) : null}
      </View>
    );
  }

  const summary = summaryQuery.data;
  const hasStats = Boolean(summary?.matchCount);
  const panelError = seasonsQuery.isError || summaryQuery.isError;
  const panelErrorMessage = seasonsQuery.error ?? summaryQuery.error;
  const refetchPanel = () => {
    void seasonsQuery.refetch();
    void summaryQuery.refetch();
  };

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <AppText variant="h4">Structured Statistics</AppText>
          <AppText variant="bodyMuted">{sportLabelFor(activeSport)}</AppText>
        </View>
        {!summaryQuery.isLoading && !summaryQuery.isError ? (
          summary?.verifiedMatchCount ? (
            <Badge tone="blue">{summary.verifiedMatchCount} VERIFIED</Badge>
          ) : (
            <Badge tone="dark">SELF-REPORTED</Badge>
          )
        ) : null}
      </View>

      {profileSports.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {profileSports.map((item) => (
            <Chip
              key={item}
              selected={item === activeSport}
              onPress={() => {
                handleSelectSport(item);
                setSeasonId(undefined);
              }}
            >
              {sportLabelFor(item)}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      {(seasonsQuery.data ?? []).length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(seasonsQuery.data ?? []).map((season) => (
            <Chip key={season.id} selected={season.id === seasonId} onPress={() => setSeasonId(season.id)}>
              {season.label}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      {seasonsQuery.isLoading || summaryQuery.isLoading ? <ActivityIndicator color={theme.accent} /> : null}

      {panelError ? (
        <QueryState error={panelErrorMessage} onRetry={refetchPanel} />
      ) : null}

      {!seasonsQuery.isLoading && !panelError && !(seasonsQuery.data ?? []).length ? (
        <View style={styles.empty}>
          <AppText variant="bodyMuted">
            {isOwnProfile
              ? `Create a ${sportLabelFor(activeSport)} season and record your first match.`
              : 'No structured statistics have been recorded for this sport.'}
          </AppText>
        </View>
      ) : null}

      {hasStats && summary ? (
        <>
          <View style={styles.overview}>
            <StatCard value={summary.matchCount} label="Matches" tone="orange" />
            <StatCard value={`${summary.winRate}%`} label="Win rate" tone="green" />
            <StatCard value={summary.verifiedMatchCount} label="Verified" />
          </View>
          <View style={styles.metrics}>
            {summary.metrics.map((metric) => (
              <View key={metric.key} style={[styles.metric, { backgroundColor: theme.surfaceMuted }]}>
                <AppText variant="small">
                  {metric.aggregation === 'average' ? 'AVG ' : metric.aggregation === 'sum' ? 'TOTAL ' : ''}
                  {metric.label.toUpperCase()}
                </AppText>
                <AppText variant="h2" color={theme.accent}>
                  {metricValue(metric.value)}
                </AppText>
                <AppText variant="small">Best {metricValue(metric.personalBest)} {metric.unit ?? ''}</AppText>
              </View>
            ))}
          </View>
          {summary.achievements.length > 0 ? (
            <View style={styles.achievements}>
              <View style={styles.sectionTitle}>
                <CheckCircle2 size={16} color={theme.success} />
                <AppText variant="h4">Achievements</AppText>
              </View>
              <View style={styles.chips}>
                {summary.achievements.map((achievement) => (
                  <Badge key={achievement.id} tone="green">
                    {achievement.badge} {achievement.title}
                  </Badge>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.actions}>
        <Button
          style={styles.action}
          variant="dark"
          icon={History}
          onPress={() => navigation.navigate('MatchHistory', {
            userId: profile.id,
            sport: activeSport,
            seasonId
          })}
        >
          Match History
        </Button>
        {isOwnProfile ? (
          <Button
            style={styles.action}
            icon={Plus}
            onPress={() => navigation.navigate('StatsEntry', { sport: activeSport })}
          >
            Record Match
          </Button>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 18, padding: spacing.md, gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleCopy: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  empty: { paddingVertical: spacing.md },
  overview: { flexDirection: 'row', gap: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metric: { minWidth: '31%', flexGrow: 1, padding: spacing.sm, borderRadius: 12, gap: spacing.xxs },
  achievements: { gap: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.xs },
  action: { flex: 1 }
});

