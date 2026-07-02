import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { blockService } from '@/services/blockService';
import { profileService, type ProfileUpdateInput } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

export const profileKeys = {
  detail: (id: string) => ['profile', id] as const,
  isFollowing: (id: string) => ['profile', 'isFollowing', id] as const,
  followRequestStatus: (id: string) => ['profile', 'followRequestStatus', id] as const,
  isBlocked: (id: string) => ['profile', 'isBlocked', id] as const,
  players: (query?: string) => ['profile', 'players', query ?? ''] as const
};

/**
 * Fetch any user's profile, including live followers/following/posts counts
 * from the DB.
 * Stale time is 5 minutes because profile data changes slowly.
 */
export const useProfile = (userId: string) =>
  useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => profileService.getProfile(userId),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(userId)
  });

/**
 * Check if the current user is already following a given profile.
 */
export const useIsFollowing = (targetId: string) =>
  useQuery({
    queryKey: profileKeys.isFollowing(targetId),
    queryFn: () => profileService.isFollowing(targetId),
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(targetId)
  });

export const useFollowRequestStatus = (targetId: string) =>
  useQuery({
    queryKey: profileKeys.followRequestStatus(targetId),
    queryFn: () => profileService.getFollowRequestStatus(targetId),
    staleTime: 30 * 1000,
    enabled: Boolean(targetId)
  });

export const useIsBlocked = (targetId: string) =>
  useQuery({
    queryKey: profileKeys.isBlocked(targetId),
    queryFn: () => blockService.isBlocked(targetId),
    staleTime: 30 * 1000,
    enabled: Boolean(targetId)
  });

/**
 * Toggle follow/unfollow for a profile.
 * Optimistically updates the cached follower count and the isFollowing flag.
 * Rolls back both on error.
 */
export const useToggleFollow = (targetId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (currentlyFollowing) {
        await profileService.unfollowProfile(targetId);
        return 'unfollowed' as const;
      } else {
        return profileService.followProfile(targetId);
      }
    },
    onMutate: async (currentlyFollowing) => {
      // Cancel in-flight queries to avoid race conditions
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileKeys.detail(targetId) }),
        queryClient.cancelQueries({ queryKey: profileKeys.isFollowing(targetId) }),
        queryClient.cancelQueries({ queryKey: profileKeys.followRequestStatus(targetId) })
      ]);

      const previousProfile = queryClient.getQueryData<UserProfile>(profileKeys.detail(targetId));
      const previousIsFollowing = queryClient.getQueryData<boolean>(profileKeys.isFollowing(targetId));
      const previousFollowRequestStatus = queryClient.getQueryData<
        'pending' | 'approved' | 'declined' | 'cancelled' | null
      >(profileKeys.followRequestStatus(targetId));
      const isPrivateRequest = Boolean(previousProfile?.isPrivate && !currentlyFollowing);

      if (!isPrivateRequest) {
        queryClient.setQueryData<UserProfile>(profileKeys.detail(targetId), (old) => {
          if (!old) return old;
          const delta = currentlyFollowing ? -1 : 1;
          return {
            ...old,
            stats: {
              ...old.stats,
              followers: Math.max(0, old.stats.followers + delta)
            }
          };
        });
      }

      queryClient.setQueryData<boolean>(profileKeys.isFollowing(targetId), isPrivateRequest ? false : !currentlyFollowing);
      if (isPrivateRequest) {
        queryClient.setQueryData(profileKeys.followRequestStatus(targetId), 'pending');
      }

      return { previousProfile, previousIsFollowing, previousFollowRequestStatus };
    },
    onSuccess: (result) => {
      if (result === 'requested') {
        queryClient.setQueryData<boolean>(profileKeys.isFollowing(targetId), false);
        queryClient.setQueryData(profileKeys.followRequestStatus(targetId), 'pending');
      }
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(profileKeys.detail(targetId), context.previousProfile);
      }
      if (context?.previousIsFollowing !== undefined) {
        queryClient.setQueryData(profileKeys.isFollowing(targetId), context.previousIsFollowing);
      }
      if (context?.previousFollowRequestStatus !== undefined) {
        queryClient.setQueryData(profileKeys.followRequestStatus(targetId), context.previousFollowRequestStatus);
      }
    },
    onSettled: () => {
      // Refetch to sync with server truth
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(targetId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.isFollowing(targetId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.followRequestStatus(targetId) });
    }
  });
};

export const useToggleBlock = (targetId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currentlyBlocked: boolean) => {
      if (currentlyBlocked) {
        await blockService.unblockUser(targetId);
      } else {
        await blockService.blockUser(targetId);
      }
      return !currentlyBlocked;
    },
    onMutate: async (currentlyBlocked) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.isBlocked(targetId) });
      const previousIsBlocked = queryClient.getQueryData<boolean>(profileKeys.isBlocked(targetId));
      queryClient.setQueryData<boolean>(profileKeys.isBlocked(targetId), !currentlyBlocked);
      return { previousIsBlocked };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousIsBlocked !== undefined) {
        queryClient.setQueryData(profileKeys.isBlocked(targetId), context.previousIsBlocked);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.isBlocked(targetId) });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    }
  });
};

/**
 * Update the current user's own profile. Syncs the auth store after a successful save.
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const setProfile = useAuthStore((state) => state.setProfile);
  const currentProfile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProfileUpdateInput }) =>
      profileService.updateProfile(id, input),
    onSuccess: (_data, { id, input }) => {
      // Merge the update into both the React Query cache and the auth store
      const merge = (old: UserProfile): UserProfile => ({
        ...old,
        displayName: input.displayName ?? old.displayName,
        username: input.username ?? old.username,
        avatarUrl: input.avatarUrl ?? old.avatarUrl,
        coverUrl: input.coverUrl ?? old.coverUrl,
        bio: input.bio ?? old.bio,
        city: input.city ?? old.city,
        primarySport: input.primarySport ?? old.primarySport,
        sports: input.sports ?? old.sports,
        position: input.position ?? old.position,
        skillLevel: input.skillLevel ?? old.skillLevel,
        isHireable: input.isHireable ?? old.isHireable,
        isPrivate: input.isPrivate ?? old.isPrivate
      });

      queryClient.setQueryData<UserProfile>(profileKeys.detail(id), (old) =>
        old ? merge(old) : old
      );

      if (currentProfile?.id === id) {
        setProfile(merge(currentProfile));
      }
    }
  });
};
