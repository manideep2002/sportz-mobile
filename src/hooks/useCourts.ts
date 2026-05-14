import { useQuery } from '@tanstack/react-query';

import { courtService } from '@/services/courtService';
import type { Sport } from '@/types/domain';

export const useCourts = (sport?: Sport) =>
  useQuery({
    queryKey: ['courts', sport ?? 'all'],
    queryFn: () => courtService.listNearbyCourts(sport)
  });
