import { useQuery } from '@tanstack/react-query';

import { communityService } from '@/services/communityService';
import type { Community } from '@/types/domain';

const communityKeys = {
  all: ['communities'] as const,
  detail: (id: string) => ['community', id] as const
};

export const useCommunities = () =>
  useQuery({
    queryKey: communityKeys.all,
    queryFn: communityService.listCommunities
  });

export const useCommunity = (id: string) =>
  useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: () => communityService.getCommunity(id),
    enabled: Boolean(id)
  });
