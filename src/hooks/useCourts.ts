import { useQuery } from '@tanstack/react-query';

import { courtService, type CourtFilters } from '@/services/courtService';

export const useCourts = (filters: CourtFilters = {}) =>
  useQuery({
    queryKey: ['courts', filters],
    queryFn: () => courtService.listNearbyCourts(filters)
  });

export const useCourt = (courtId: string) =>
  useQuery({
    queryKey: ['courts', courtId],
    queryFn: () => courtService.getCourt(courtId),
    enabled: Boolean(courtId)
  });
