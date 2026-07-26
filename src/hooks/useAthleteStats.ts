import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  athleteStatsService,
  type RecordMatchInput
} from '@/services/athleteStatsService';
import type { StructuredSport } from '@/types/domain';

export const athleteStatsKeys = {
  all: ['athlete-stats'] as const,
  seasons: (athleteId: string, sport?: StructuredSport) =>
    ['athlete-stats', athleteId, 'seasons', sport ?? 'all'] as const,
  matches: (athleteId: string, seasonId?: string) =>
    ['athlete-stats', athleteId, 'matches', seasonId ?? 'all'] as const,
  summary: (athleteId: string, sport: StructuredSport, seasonId?: string) =>
    ['athlete-stats', athleteId, 'summary', sport, seasonId ?? 'latest'] as const
};

export const useAthleteSeasons = (athleteId: string, sport?: StructuredSport) =>
  useQuery({
    queryKey: athleteStatsKeys.seasons(athleteId, sport),
    queryFn: () => athleteStatsService.listSeasons(athleteId, sport),
    enabled: Boolean(athleteId)
  });

export const useAthleteMatches = (athleteId: string, seasonId?: string) =>
  useQuery({
    queryKey: athleteStatsKeys.matches(athleteId, seasonId),
    queryFn: () => athleteStatsService.listMatches(athleteId, seasonId),
    enabled: Boolean(athleteId)
  });

export const useAthleteStatSummary = (
  athleteId: string,
  sport: StructuredSport,
  seasonId?: string
) =>
  useQuery({
    queryKey: athleteStatsKeys.summary(athleteId, sport, seasonId),
    queryFn: () => athleteStatsService.getSummary(athleteId, sport, seasonId),
    enabled: Boolean(athleteId)
  });

export const useCreateAthleteSeason = (athleteId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: athleteStatsService.createSeason,
    onSuccess: (season) => {
      void queryClient.invalidateQueries({ queryKey: athleteStatsKeys.seasons(athleteId, season.sport) });
    }
  });
};

export const useRecordAthleteMatch = (athleteId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordMatchInput) => athleteStatsService.recordMatch(input),
    onSuccess: (match) => {
      void queryClient.invalidateQueries({ queryKey: athleteStatsKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['profile', athleteId] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
      void queryClient.invalidateQueries({ queryKey: athleteStatsKeys.matches(athleteId, match.seasonId) });
    }
  });
};

