import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type {
  AthleteAchievement,
  AthleteMatch,
  AthleteSeason,
  AthleteStatMetric,
  AthleteStatSummary,
  MatchOutcome,
  SportStatDefinition,
  StatVerificationStatus,
  StructuredSport,
  VerificationDetail,
  VerificationQueueItem
} from '@/types/domain';

type StatSchema = Omit<SportStatDefinition, 'id' | 'sport'>;

export const STRUCTURED_SPORTS: StructuredSport[] = ['basketball', 'football', 'cricket'];

export const SPORT_STAT_SCHEMAS: Readonly<Record<StructuredSport, readonly StatSchema[]>> = {
  basketball: [
    { key: 'points', label: 'Points', valueType: 'integer', unit: 'PTS', aggregation: 'average', required: true, minimum: 0, maximum: 200, displayOrder: 10 },
    { key: 'rebounds', label: 'Rebounds', valueType: 'integer', unit: 'REB', aggregation: 'average', required: true, minimum: 0, maximum: 100, displayOrder: 20 },
    { key: 'assists', label: 'Assists', valueType: 'integer', unit: 'AST', aggregation: 'average', required: true, minimum: 0, maximum: 100, displayOrder: 30 },
    { key: 'steals', label: 'Steals', valueType: 'integer', unit: 'STL', aggregation: 'average', required: false, minimum: 0, maximum: 30, displayOrder: 40 },
    { key: 'blocks', label: 'Blocks', valueType: 'integer', unit: 'BLK', aggregation: 'average', required: false, minimum: 0, maximum: 30, displayOrder: 50 },
    { key: 'minutes', label: 'Minutes', valueType: 'decimal', unit: 'MIN', aggregation: 'average', required: false, minimum: 0, maximum: 100, displayOrder: 60 }
  ],
  football: [
    { key: 'goals', label: 'Goals', valueType: 'integer', unit: 'G', aggregation: 'sum', required: true, minimum: 0, maximum: 30, displayOrder: 10 },
    { key: 'assists', label: 'Assists', valueType: 'integer', unit: 'A', aggregation: 'sum', required: true, minimum: 0, maximum: 30, displayOrder: 20 },
    { key: 'minutes', label: 'Minutes', valueType: 'integer', unit: 'MIN', aggregation: 'sum', required: true, minimum: 0, maximum: 180, displayOrder: 30 },
    { key: 'shots_on_target', label: 'Shots on target', valueType: 'integer', unit: 'SOT', aggregation: 'sum', required: false, minimum: 0, maximum: 50, displayOrder: 40 },
    { key: 'tackles', label: 'Tackles', valueType: 'integer', unit: 'TCK', aggregation: 'average', required: false, minimum: 0, maximum: 100, displayOrder: 50 },
    { key: 'saves', label: 'Saves', valueType: 'integer', unit: 'SV', aggregation: 'sum', required: false, minimum: 0, maximum: 50, displayOrder: 60 }
  ],
  cricket: [
    { key: 'runs', label: 'Runs', valueType: 'integer', unit: 'RUNS', aggregation: 'average', required: true, minimum: 0, maximum: 1000, displayOrder: 10 },
    { key: 'wickets', label: 'Wickets', valueType: 'integer', unit: 'WKTS', aggregation: 'sum', required: true, minimum: 0, maximum: 20, displayOrder: 20 },
    { key: 'balls_faced', label: 'Balls faced', valueType: 'integer', unit: 'BF', aggregation: 'sum', required: true, minimum: 0, maximum: 1000, displayOrder: 30 },
    { key: 'overs_bowled', label: 'Overs bowled', valueType: 'decimal', unit: 'OV', aggregation: 'sum', required: false, minimum: 0, maximum: 100, displayOrder: 40 },
    { key: 'runs_conceded', label: 'Runs conceded', valueType: 'integer', unit: 'RC', aggregation: 'sum', required: false, minimum: 0, maximum: 1000, displayOrder: 50 },
    { key: 'catches', label: 'Catches', valueType: 'integer', unit: 'CT', aggregation: 'sum', required: false, minimum: 0, maximum: 20, displayOrder: 60 }
  ]
};

export const sportKeyFor = (sport: string): StructuredSport | undefined => {
  const normalized = sport.trim().toLowerCase();
  return STRUCTURED_SPORTS.find((candidate) => candidate === normalized);
};

export const sportLabelFor = (sport: StructuredSport) =>
  sport.charAt(0).toUpperCase() + sport.slice(1);

export const validateSportStats = (
  sport: StructuredSport,
  stats: Record<string, number | undefined>
): Record<string, number> => {
  const schema = SPORT_STAT_SCHEMAS[sport];
  const definitions = new Map(schema.map((definition) => [definition.key, definition]));
  const result: Record<string, number> = {};

  for (const key of Object.keys(stats)) {
    if (!definitions.has(key)) {
      throw new Error(`${key} is not a valid ${sportLabelFor(sport)} statistic.`);
    }
  }

  for (const definition of schema) {
    const value = stats[definition.key];
    if (value === undefined || Number.isNaN(value)) {
      if (definition.required) throw new Error(`${definition.label} is required.`);
      continue;
    }
    if (!Number.isFinite(value)) throw new Error(`${definition.label} must be a number.`);
    if (definition.valueType === 'integer' && !Number.isInteger(value)) {
      throw new Error(`${definition.label} must be a whole number.`);
    }
    if (definition.minimum != null && value < definition.minimum) {
      throw new Error(`${definition.label} must be at least ${definition.minimum}.`);
    }
    if (definition.maximum != null && value > definition.maximum) {
      throw new Error(`${definition.label} must be at most ${definition.maximum}.`);
    }
    result[definition.key] = value;
  }
  return result;
};

export const aggregateSportStats = (
  sport: StructuredSport,
  matches: {
    outcome: MatchOutcome;
    verificationStatus?: StatVerificationStatus;
    stats: Record<string, number>;
  }[]
): Omit<AthleteStatSummary, 'athleteId' | 'season' | 'achievements'> => {
  const included = matches.filter((match) => match.verificationStatus !== 'rejected');
  const metrics: AthleteStatMetric[] = SPORT_STAT_SCHEMAS[sport].flatMap((definition) => {
    const values = included
      .map((match) => match.stats[definition.key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!values.length) return [];
    const total = values.reduce((sum, value) => sum + value, 0);
    const value = definition.aggregation === 'sum'
      ? total
      : definition.aggregation === 'maximum'
        ? Math.max(...values)
        : definition.aggregation === 'minimum'
          ? Math.min(...values)
          : total / values.length;
    return [{
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      aggregation: definition.aggregation,
      matchCount: values.length,
      value: Number(value.toFixed(2)),
      personalBest: Math.max(...values)
    }];
  });
  const wins = included.filter((match) => match.outcome === 'win').length;
  return {
    sport,
    matchCount: included.length,
    wins,
    winRate: included.length ? Number(((wins / included.length) * 100).toFixed(2)) : 0,
    verifiedMatchCount: included.filter((match) => match.verificationStatus === 'verified').length,
    metrics
  };
};

const ACHIEVEMENT_RULES: Readonly<Record<StructuredSport, readonly {
  key: string;
  title: string;
  statKey: string;
  metric: 'sum' | 'maximum';
  threshold: number;
}[]>> = {
  basketball: [
    { key: 'thirty_point_game', title: '30 Point Game', statKey: 'points', metric: 'maximum', threshold: 30 },
    { key: 'double_digit_assists', title: 'Floor General', statKey: 'assists', metric: 'maximum', threshold: 10 }
  ],
  football: [
    { key: 'hat_trick', title: 'Hat Trick', statKey: 'goals', metric: 'maximum', threshold: 3 },
    { key: 'ten_goals', title: 'Double Digits', statKey: 'goals', metric: 'sum', threshold: 10 }
  ],
  cricket: [
    { key: 'century', title: 'Century', statKey: 'runs', metric: 'maximum', threshold: 100 },
    { key: 'five_wickets', title: 'Five-Wicket Haul', statKey: 'wickets', metric: 'maximum', threshold: 5 }
  ]
};

export const generatedAchievementKeys = (
  sport: StructuredSport,
  matches: { stats: Record<string, number> }[]
) => ACHIEVEMENT_RULES[sport]
  .filter((rule) => {
    const values = matches
      .map((match) => match.stats[rule.statKey])
      .filter((value): value is number => typeof value === 'number');
    if (!values.length) return false;
    const metric = rule.metric === 'sum'
      ? values.reduce((sum, value) => sum + value, 0)
      : Math.max(...values);
    return metric >= rule.threshold;
  })
  .map((rule) => rule.key);

interface CreateSeasonInput {
  sport: StructuredSport;
  label: string;
  startsOn: string;
  endsOn: string;
}

export interface RecordMatchInput {
  seasonId: string;
  sport: StructuredSport;
  playedOn: string;
  teamName: string;
  opponentName: string;
  teamScore?: number | null;
  opponentScore?: number | null;
  outcome: MatchOutcome;
  stats: Record<string, number | undefined>;
}

const mapSeason = (row: Record<string, unknown>): AthleteSeason => ({
  id: row.id as string,
  athleteId: row.athlete_id as string,
  sport: row.sport as StructuredSport,
  label: row.label as string,
  startsOn: row.starts_on as string,
  endsOn: row.ends_on as string,
  createdAt: row.created_at as string
});

const relationFirst = <T>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value ?? undefined;

const mapMatch = (row: Record<string, any>): AthleteMatch => ({
  id: row.id,
  athleteId: row.athlete_id,
  seasonId: row.season_id,
  sport: row.sport,
  playedOn: row.played_on,
  teamName: row.team_name,
  opponentName: row.opponent_name,
  teamScore: row.team_score,
  opponentScore: row.opponent_score,
  outcome: row.outcome,
  verificationStatus: row.verification_status,
  verificationSource: row.verification_source,
  evidenceUrl: row.evidence_url,
  createdAt: row.created_at,
  stats: (row.stats ?? []).flatMap((raw: Record<string, any>) => {
    const definition = relationFirst(raw.definition);
    return definition ? [{
      definitionId: definition.id,
      key: definition.stat_key,
      label: definition.label,
      unit: definition.unit,
      value: Number(raw.value)
    }] : [];
  })
});

export const athleteStatsService = {
  async listSeasons(athleteId: string, sport?: StructuredSport): Promise<AthleteSeason[]> {
    assertSupabaseConfigured();
    let request = supabase
      .from('athlete_seasons')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('starts_on', { ascending: false });
    if (sport) request = request.eq('sport', sport);
    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []).map((row) => mapSeason(row as Record<string, unknown>));
  },

  async createSeason(input: CreateSeasonInput): Promise<AthleteSeason> {
    assertSupabaseConfigured();
    if (!input.label.trim()) throw new Error('Season label is required.');
    if (input.endsOn < input.startsOn) throw new Error('Season end must be on or after its start.');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create a season.');
    const { data, error } = await supabase
      .from('athlete_seasons')
      .insert({
        athlete_id: authData.user.id,
        sport: input.sport,
        label: input.label.trim(),
        starts_on: input.startsOn,
        ends_on: input.endsOn
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapSeason(data as Record<string, unknown>);
  },

  async recordMatch(input: RecordMatchInput): Promise<AthleteMatch> {
    assertSupabaseConfigured();
    if (!input.teamName.trim() || !input.opponentName.trim()) {
      throw new Error('Team and opponent are required.');
    }
    const stats = validateSportStats(input.sport, input.stats);
    const { data, error } = await supabase.rpc('record_athlete_match', {
      target_season_id: input.seasonId,
      target_played_on: input.playedOn,
      target_team_name: input.teamName.trim(),
      target_opponent_name: input.opponentName.trim(),
      target_team_score: input.teamScore ?? null,
      target_opponent_score: input.opponentScore ?? null,
      target_outcome: input.outcome,
      target_stats: stats
    });
    if (error) throw error;
    return this.getMatch((data as { id: string }).id);
  },

  async getMatch(matchId: string): Promise<AthleteMatch> {
    assertSupabaseConfigured();
    const { data, error } = await supabase
      .from('athlete_matches')
      .select('*, stats:athlete_match_stats(value, definition:sport_stat_definitions(*))')
      .eq('id', matchId)
      .single();
    if (error) throw error;
    return mapMatch(data as Record<string, any>);
  },

  async listMatches(athleteId: string, seasonId?: string): Promise<AthleteMatch[]> {
    assertSupabaseConfigured();
    let request = supabase
      .from('athlete_matches')
      .select('*, stats:athlete_match_stats(value, definition:sport_stat_definitions(*))')
      .eq('athlete_id', athleteId)
      .order('played_on', { ascending: false });
    if (seasonId) request = request.eq('season_id', seasonId);
    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []).map((row) => mapMatch(row as Record<string, any>));
  },

  async getSummary(
    athleteId: string,
    sport: StructuredSport,
    seasonId?: string
  ): Promise<AthleteStatSummary> {
    assertSupabaseConfigured();
    const seasons = await this.listSeasons(athleteId, sport);
    const season = seasonId
      ? seasons.find((candidate) => candidate.id === seasonId)
      : seasons[0];
    if (!season) {
      return {
        athleteId,
        sport,
        matchCount: 0,
        wins: 0,
        winRate: 0,
        verifiedMatchCount: 0,
        metrics: [],
        achievements: []
      };
    }

    const [matches, aggregateResult, achievementResult] = await Promise.all([
      this.listMatches(athleteId, season.id),
      supabase
        .from('athlete_stat_aggregates')
        .select('*')
        .eq('athlete_id', athleteId)
        .eq('season_id', season.id)
        .order('stat_key'),
      supabase
        .from('athlete_achievements')
        .select('*, definition:definition_id(*)')
        .eq('athlete_id', athleteId)
        .eq('season_id', season.id)
        .order('awarded_at', { ascending: false })
    ]);
    if (aggregateResult.error) throw aggregateResult.error;
    if (achievementResult.error) throw achievementResult.error;

    const base = aggregateSportStats(
      sport,
      matches.map((match) => ({
        outcome: match.outcome,
        verificationStatus: match.verificationStatus,
        stats: Object.fromEntries(match.stats.map((stat) => [stat.key, stat.value]))
      }))
    );
    const metrics = (aggregateResult.data ?? []).map((raw) => {
      const row = raw as Record<string, any>;
      const aggregateValue = row.aggregation === 'sum'
        ? row.total_value
        : row.aggregation === 'maximum'
          ? row.maximum_value
          : row.aggregation === 'minimum'
            ? row.minimum_value
            : row.average_value;
      return {
        key: row.stat_key,
        label: row.label,
        unit: row.unit,
        aggregation: row.aggregation,
        matchCount: Number(row.match_count),
        value: Number(Number(aggregateValue).toFixed(2)),
        personalBest: Number(row.maximum_value)
      } satisfies AthleteStatMetric;
    });
    const achievements: AthleteAchievement[] = (achievementResult.data ?? []).flatMap((raw) => {
      const row = raw as Record<string, any>;
      const definition = relationFirst(row.definition);
      return definition ? [{
        id: row.id,
        title: definition.title,
        description: definition.description,
        badge: definition.badge,
        progress: Number(row.progress),
        awardedAt: row.awarded_at
      }] : [];
    });

    return { athleteId, season, ...base, metrics, achievements };
  },

  async verifyMatch(matchId: string, status: 'verified' | 'rejected', source: string, reason?: string): Promise<AthleteMatch> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('verify_athlete_match', {
      target_match_id: matchId,
      target_status: status,
      target_source: source,
      target_reason: reason ?? null
    });
    if (error) throw error;
    return this.getMatch((data as { id: string }).id);
  },

  async listPendingVerifications(limit = 20, offset = 0): Promise<VerificationQueueItem[]> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('list_pending_verifications', {
      p_limit: limit,
      p_offset: offset
    });
    if (error) throw error;
    return (data as unknown as VerificationQueueItem[]) ?? [];
  },

  async getVerificationDetail(matchId: string): Promise<VerificationDetail> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('get_verification_detail', {
      p_match_id: matchId
    });
    if (error) throw error;
    if (!data) throw new Error('Match not found.');
    const raw = data as Record<string, any>;
    return {
      match: mapMatch(raw.match as Record<string, any>),
      athlete: raw.athlete as VerificationDetail['athlete'],
      season: mapSeason(raw.season as Record<string, unknown>),
      stats: (raw.stats ?? []) as VerificationDetail['stats'],
      auditLog: (raw.auditLog ?? []) as VerificationDetail['auditLog']
    };
  },

  async currentUserCanVerify(): Promise<boolean> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('current_user_can_verify');
    if (error) return false;
    return data as boolean;
  },

  async deleteMatch(matchId: string): Promise<void> {
    assertSupabaseConfigured();
    const { error } = await supabase.from('athlete_matches').delete().eq('id', matchId);
    if (error) throw error;
  }
};
