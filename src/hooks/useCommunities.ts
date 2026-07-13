import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { communityService, type CreateCommunityInput } from '@/services/communityService';
import type { CommunityMemberRole } from '@/types/domain';

export const communityKeys = {
  all: ['communities'] as const,
  detail: (id: string) => ['communities', id] as const,
  invites: ['communities', 'invites'] as const,
  members: (id: string) => ['communities', id, 'members'] as const,
  requests: (id: string) => ['communities', id, 'requests'] as const
};

const invalidateCommunity = (queryClient: QueryClient, communityId?: string) => {
  void queryClient.invalidateQueries({ queryKey: communityKeys.all });
  void queryClient.invalidateQueries({ queryKey: communityKeys.invites });
  void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  if (communityId) {
    void queryClient.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
    void queryClient.invalidateQueries({ queryKey: communityKeys.members(communityId) });
    void queryClient.invalidateQueries({ queryKey: communityKeys.requests(communityId) });
    void queryClient.invalidateQueries({ queryKey: ['feed', 'community', communityId] });
  }
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
    onSuccess: (community) => {
      invalidateCommunity(queryClient, community.id);
    }
  });
};

export const useJoinCommunity = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: 'member' | 'follower' = 'member') => communityService.joinCommunity(communityId, role),
    onSuccess: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};

export const useLeaveCommunity = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => communityService.leaveCommunity(communityId),
    onSuccess: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};

export const usePendingCommunityInvites = () =>
  useQuery({
    queryKey: communityKeys.invites,
    queryFn: communityService.listPendingInvites
  });

export const useInviteCommunityMember = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => communityService.inviteMember(communityId, userId),
    onSuccess: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};

export const useRespondCommunityInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, communityId, approve }: { inviteId?: string; communityId?: string; approve: boolean }) => {
      if (inviteId) return communityService.respondToInvite(inviteId, approve);
      if (communityId) return communityService.respondToInviteForCommunity(communityId, approve);
      throw new Error('Invite not found.');
    },
    onSuccess: (_data, variables) => {
      invalidateCommunity(queryClient, variables.communityId);
    }
  });
};

export const useCommunityMembers = (communityId: string, enabled = true) =>
  useQuery({
    queryKey: communityKeys.members(communityId),
    queryFn: () => communityService.listMembers(communityId),
    enabled: Boolean(communityId) && enabled
  });

export const useCommunityJoinRequests = (communityId: string, enabled = true) =>
  useQuery({
    queryKey: communityKeys.requests(communityId),
    queryFn: () => communityService.listJoinRequests(communityId),
    enabled: Boolean(communityId) && enabled
  });

export const useRespondCommunityJoinRequest = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      communityService.respondToJoinRequest(requestId, approve),
    onSuccess: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};

export const useUpdateCommunityMemberRole = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<CommunityMemberRole, 'owner'> }) =>
      communityService.updateMemberRole(communityId, userId, role),
    onSuccess: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};

export const useRemoveCommunityMember = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => communityService.removeMember(communityId, userId),
    onSuccess: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};
