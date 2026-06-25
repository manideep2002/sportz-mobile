import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileService, type ProfileUpdateInput } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

export const profileKeys = {
  detail: (id: string) => ['profile', id] as const,
  isFollowing: (id: string) => ['profile', 'isFollowing', id] as const,
  players: (query?: string) => ['profile', 'players', query ?? ''] as const
};

/**
 * Fetch any user's profile, including live followers/following/posts counts
 * from the DB. Falls back to mock data when Supabase is not configured.
 * Stale time is 5 min — profile data doesn't change very often.
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
 * Returns false in mock mode.
 */
export const useIsFollowing = (targetId: string) =>
  useQuery({
    queryKey: profileKeys.isFollowing(targetId),
    queryFn: () => profileService.isFollowing(targetId),
    staleTime: 2 * 60 * 1000,
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
      } else {
        await profileService.followProfile(targetId);
      }
      return !currentlyFollowing;
    },
    onMutate: async (currentlyFollowing) => {
      // Cancel in-flight queries to avoid race conditions
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileKeys.detail(targetId) }),
        queryClient.cancelQueries({ queryKey: profileKeys.isFollowing(targetId) })
      ]);

      const previousProfile = queryClient.getQueryData<UserProfile>(profileKeys.detail(targetId));
      const previousIsFollowing = queryClient.getQueryData<boolean>(profileKeys.isFollowing(targetId));

      // Optimistically flip the follower count
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

      // Optimistically flip the isFollowing flag
      queryClient.setQueryData<boolean>(profileKeys.isFollowing(targetId), !currentlyFollowing);

      return { previousProfile, previousIsFollowing };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(profileKeys.detail(targetId), context.previousProfile);
      }
      if (context?.previousIsFollowing !== undefined) {
        queryClient.setQueryData(profileKeys.isFollowing(targetId), context.previousIsFollowing);
      }
    },
    onSettled: () => {
      // Refetch to sync with server truth
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(targetId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.isFollowing(targetId) });
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
        bio: input.bio ?? old.bio,
        city: input.city ?? old.city,
        primarySport: input.primarySport ?? old.primarySport,
        sports: input.sports ?? old.sports,
        position: input.position ?? old.position,
        skillLevel: input.skillLevel ?? old.skillLevel,
        isHireable: input.isHireable ?? old.isHireable
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
