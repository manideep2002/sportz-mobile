import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { communityService, type CreateCommunityInput } from '@/services/communityService';

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

export const useCreateCommunity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommunityInput) => communityService.createCommunity(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all });
    }
  });
};

export const useJoinCommunity = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: 'member' | 'follower' = 'member') => communityService.joinCommunity(communityId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all });
      void queryClient.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
    }
  });
};

export const useLeaveCommunity = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => communityService.leaveCommunity(communityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all });
      void queryClient.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
    }
  });
};
