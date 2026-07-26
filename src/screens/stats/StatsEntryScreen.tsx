import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft, Plus } from 'lucide-react-native';

import { AppText, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import {
  useAthleteSeasons,
  useCreateAthleteSeason,
  useRecordAthleteMatch
} from '@/hooks/useAthleteStats';
import type { AppStackParamList } from '@/navigation/routes';
import {
  SPORT_STAT_SCHEMAS,
  STRUCTURED_SPORTS,
  sportKeyFor,
  sportLabelFor
} from '@/services/athleteStatsService';
import { useAuthStore } from '@/store/authStore';
import type { MatchOutcome, StructuredSport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StatsEntry'>;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function StatsEntryScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const defaultSport = route.params?.sport
    ?? sportKeyFor(profile?.primarySport ?? '')
    ?? 'basketball';
  const [sport, setSport] = useState<StructuredSport>(defaultSport);
  const seasonsQuery = useAthleteSeasons(profile?.id ?? '', sport);
  const createSeason = useCreateAthleteSeason(profile?.id ?? '');
  const recordMatch = useRecordAthleteMatch(profile?.id ?? '');
  const [seasonId, setSeasonId] = useState('');
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const currentYear = new Date().getFullYear();
  const [seasonLabel, setSeasonLabel] = useState(`${currentYear}/${String(currentYear + 1).slice(-2)}`);
  const [seasonStart, setSeasonStart] = useState(`${currentYear}-01-01`);
  const [seasonEnd, setSeasonEnd] = useState(`${currentYear}-12-31`);
  const [playedOn, setPlayedOn] = useState(isoDate(new Date()));
  const [teamName, setTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [teamScore, setTeamScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [outcome, setOutcome] = useState<MatchOutcome>('win');
  const [statValues, setStatValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const first = seasonsQuery.data?.[0];
    if (first && !seasonsQuery.data?.some((season) => season.id === seasonId)) {
      setSeasonId(first.id);
      setShowSeasonForm(false);
    } else if (!seasonsQuery.isLoading && !first) {
      setSeasonId('');
      setShowSeasonForm(true);
    }
  }, [seasonId, seasonsQuery.data, seasonsQuery.isLoading]);

  useEffect(() => {
    setStatValues({});
    setSeasonId('');
  }, [sport]);

  const schema = useMemo(() => SPORT_STAT_SCHEMAS[sport], [sport]);

  const submitSeason = async () => {
    try {
      const season = await createSeason.mutateAsync({
        sport,
        label: seasonLabel,
        startsOn: seasonStart,
        endsOn: seasonEnd
      });
      setSeasonId(season.id);
      setShowSeasonForm(false);
    } catch (error) {
      Alert.alert('Could not create season', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const submitMatch = async () => {
    const parsedStats = Object.fromEntries(
      Object.entries(statValues)
        .filter(([, value]) => value.trim() !== '')
        .map(([key, value]) => [key, Number(value)])
    );
    const parseOptionalScore = (value: string) => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('Scores must be non-negative whole numbers.');
      }
      return parsed;
    };
    try {
      const match = await recordMatch.mutateAsync({
        seasonId,
        sport,
        playedOn,
        teamName,
        opponentName,
        teamScore: parseOptionalScore(teamScore),
        opponentScore: parseOptionalScore(opponentScore),
        outcome,
        stats: parsedStats
      });
      navigation.replace('MatchHistory', { userId: profile?.id, sport, seasonId: match.seasonId });
    } catch (error) {
      Alert.alert('Could not record match', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Record Match</AppText>
        <IconButton icon={Plus} accessibilityLabel="Create season" onPress={() => setShowSeasonForm(true)} />
      </View>

      <AppText variant="small" color={theme.textSubtle}>SPORT</AppText>
      <View style={styles.chips}>
        {STRUCTURED_SPORTS.map((item) => (
          <Chip key={item} selected={sport === item} onPress={() => setSport(item)}>
            {sportLabelFor(item)}
          </Chip>
        ))}
      </View>

      {!showSeasonForm && (seasonsQuery.data ?? []).length ? (
        <>
          <AppText variant="small" color={theme.textSubtle}>SEASON</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(seasonsQuery.data ?? []).map((season) => (
              <Chip key={season.id} selected={season.id === seasonId} onPress={() => setSeasonId(season.id)}>
                {season.label}
              </Chip>
            ))}
          </ScrollView>
        </>
      ) : null}

      {showSeasonForm ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="h4">New {sportLabelFor(sport)} Season</AppText>
          <Input label="Season label" value={seasonLabel} onChangeText={setSeasonLabel} />
          <Input label="Starts (YYYY-MM-DD)" value={seasonStart} onChangeText={setSeasonStart} />
          <Input label="Ends (YYYY-MM-DD)" value={seasonEnd} onChangeText={setSeasonEnd} />
          <Button loading={createSeason.isPending} onPress={() => void submitSeason()}>Create Season</Button>
        </View>
      ) : null}

      {seasonId ? (
        <>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">Match</AppText>
            <Input label="Date (YYYY-MM-DD)" value={playedOn} onChangeText={setPlayedOn} />
            <Input label="Your team" value={teamName} onChangeText={setTeamName} />
            <Input label="Opponent" value={opponentName} onChangeText={setOpponentName} />
            <View style={styles.scoreRow}>
              <View style={styles.flex}>
                <Input label="Team score" value={teamScore} onChangeText={setTeamScore} keyboardType="number-pad" />
              </View>
              <View style={styles.flex}>
                <Input label="Opponent score" value={opponentScore} onChangeText={setOpponentScore} keyboardType="number-pad" />
              </View>
            </View>
            <AppText variant="small" color={theme.textSubtle}>RESULT</AppText>
            <View style={styles.chips}>
              {(['win', 'loss', 'draw', 'no_result'] as const).map((item) => (
                <Chip key={item} selected={outcome === item} onPress={() => setOutcome(item)}>
                  {item.replace('_', ' ')}
                </Chip>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View>
              <AppText variant="h4">{sportLabelFor(sport)} Statistics</AppText>
              <AppText variant="bodyMuted">Required values are marked with *.</AppText>
            </View>
            {schema.map((definition) => (
              <Input
                key={definition.key}
                label={`${definition.label}${definition.required ? ' *' : ''}${definition.unit ? ` (${definition.unit})` : ''}`}
                value={statValues[definition.key] ?? ''}
                onChangeText={(value) => setStatValues((current) => ({ ...current, [definition.key]: value }))}
                keyboardType="decimal-pad"
              />
            ))}
          </View>
          <Button full size="lg" loading={recordMatch.isPending} onPress={() => void submitMatch()}>
            Save Self-Reported Stats
          </Button>
          <AppText variant="small" style={styles.note}>
            Team managers or moderators can verify a submitted record. Verified and self-reported results are labeled separately.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.md },
  scoreRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  note: { textAlign: 'center', paddingHorizontal: spacing.md }
});
