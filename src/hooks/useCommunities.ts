import { useQuery } from '@tanstack/react-query';

import { communityService } from '@/services/communityService';
import type { Community } from '@/types/domain';

export const communityKeys = {
  all: ['communities'] as const,
  detail: (id: string) => ['communities', id] as const
};

export const useCommunities = () =>
  useQuery({
    queryKey: communityKeys.all,
    queryFn: communityService.listCommunities
  });

export const useCommunity = (communityId: string) =>
  useQuery({
    queryKey: communityKeys.detail(communityId),
    queryFn: () => communityService.getCommunity(communityId),
    enabled: !!communityId
  });