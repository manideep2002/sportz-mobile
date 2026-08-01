import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  communityService,
  type CommunityListOptions,
  type CreateCommunityInput,
  type UpdateCommunitySettingsInput
} from '@/services/communityService';
import type { CommunityMemberRole } from '@/types/domain';

export const communityKeys = {
  all: ['communities'] as const,
  detail: (id: string) => ['communities', id] as const,
  invites: ['communities', 'invites'] as const,
  members: (id: string) => ['communities', id, 'members'] as const,
  requests: (id: string) => ['communities', id, 'requests'] as const,
  audit: (id: string) => ['communities', id, 'audit'] as const,
  invite: (id: string) => ['communities', 'invite', id] as const
};

const invalidateCommunity = (queryClient: QueryClient, communityId?: string) => {
  void queryClient.invalidateQueries({ queryKey: communityKeys.all });
  void queryClient.invalidateQueries({ queryKey: communityKeys.invites });
  void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  if (communityId) {
    void queryClient.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
    void queryClient.invalidateQueries({ queryKey: communityKeys.members(communityId) });
    void queryClient.invalidateQueries({ queryKey: communityKeys.requests(communityId) });
    void queryClient.invalidateQueries({ queryKey: communityKeys.audit(communityId) });
    void queryClient.invalidateQueries({ queryKey: ['feed', 'community', communityId] });
  }
};

export const useCommunities = (options: CommunityListOptions = {}) =>
  useQuery({
    queryKey: [...communityKeys.all, options],
    queryFn: () => communityService.listCommunities(options)
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
    onMutate: async (userId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: communityKeys.members(communityId) }),
        queryClient.cancelQueries({ queryKey: communityKeys.detail(communityId) })
      ]);
      const previousMembers = queryClient.getQueryData(communityKeys.members(communityId));
      const previousCommunity = queryClient.getQueryData(communityKeys.detail(communityId));
      queryClient.setQueryData(communityKeys.members(communityId), (members: unknown) =>
        Array.isArray(members)
          ? members.filter((member) => (member as { userId?: string }).userId !== userId)
          : members
      );
      queryClient.setQueryData(communityKeys.detail(communityId), (community: unknown) => {
        if (!community || typeof community !== 'object') return community;
        const current = community as { memberCount?: number; followerCount?: number };
        return {
          ...current,
          memberCount: Math.max(0, (current.memberCount ?? 0) - 1),
          followerCount: current.followerCount == null ? current.followerCount : Math.max(0, current.followerCount - 1)
        };
      });
      return { previousMembers, previousCommunity };
    },
    onError: (_error, _userId, context) => {
      if (context?.previousMembers !== undefined) {
        queryClient.setQueryData(communityKeys.members(communityId), context.previousMembers);
      }
      if (context?.previousCommunity !== undefined) {
        queryClient.setQueryData(communityKeys.detail(communityId), context.previousCommunity);
      }
    },
    onSettled: () => {
      invalidateCommunity(queryClient, communityId);
    }
  });
};

export const useUpdateCommunitySettings = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCommunitySettingsInput) => communityService.updateSettings(communityId, input),
    onSuccess: () => invalidateCommunity(queryClient, communityId)
  });
};

export const useTransferCommunityOwnership = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => communityService.transferOwnership(communityId, userId),
    onSuccess: () => invalidateCommunity(queryClient, communityId)
  });
};

export const useSetCommunityArchived = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => communityService.setArchived(communityId, archived),
    onSuccess: () => invalidateCommunity(queryClient, communityId)
  });
};

export const useDeleteCommunity = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => communityService.deleteCommunity(communityId),
    onSuccess: () => invalidateCommunity(queryClient, communityId)
  });
};

export const useRemoveCommunityPost = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason?: string }) =>
      communityService.removePost(communityId, postId, reason),
    onSuccess: () => invalidateCommunity(queryClient, communityId)
  });
};

export const useCommunityAuditLog = (communityId: string, enabled = true) =>
  useQuery({
    queryKey: communityKeys.audit(communityId),
    queryFn: () => communityService.listAuditLog(communityId),
    enabled: Boolean(communityId) && enabled
  });

export const useCommunityInvite = (inviteId: string) =>
  useQuery({
    queryKey: communityKeys.invite(inviteId),
    queryFn: () => communityService.getInvite(inviteId),
    enabled: Boolean(inviteId)
  });
