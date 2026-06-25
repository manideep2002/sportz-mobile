import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileService, type ProfileUpdateInput } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

export const profileKeys = {
  detail: (id: string) => ['profile', id] as const,
  players: (query?: string) => ['profile', 'players', query ?? ''] as const
};

/**
 * Fetch any user's profile. Falls back to mock data when Supabase is not configured.
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
 * Follow a user. Optimistically updates the cached profile's follower count.
 */
export const useFollowProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => profileService.followProfile(profileId),
    onMutate: async (profileId) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.detail(profileId) });
      const previous = queryClient.getQueryData<UserProfile>(profileKeys.detail(profileId));

      queryClient.setQueryData<UserProfile>(profileKeys.detail(profileId), (old) =>
        old
          ? {
              ...old,
              stats: { ...old.stats, followers: old.stats.followers + 1 }
            }
          : old
      );

      return { previous, profileId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKeys.detail(context.profileId), context.previous);
      }
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
      queryClient.setQueryData<UserProfile>(profileKeys.detail(id), (old) => {
        if (!old) return old;
        const updated: UserProfile = {
          ...old,
          displayName: input.displayName ?? old.displayName,
          bio: input.bio ?? old.bio,
          city: input.city ?? old.city,
          primarySport: input.primarySport ?? old.primarySport,
          sports: input.sports ?? old.sports,
          position: input.position ?? old.position,
          skillLevel: input.skillLevel ?? old.skillLevel,
          isHireable: input.isHireable ?? old.isHireable
        };
        return updated;
      });

      if (currentProfile?.id === id) {
        const updated: UserProfile = {
          ...currentProfile,
          displayName: input.displayName ?? currentProfile.displayName,
          bio: input.bio ?? currentProfile.bio,
          city: input.city ?? currentProfile.city,
          primarySport: input.primarySport ?? currentProfile.primarySport,
          sports: input.sports ?? currentProfile.sports,
          position: input.position ?? currentProfile.position,
          skillLevel: input.skillLevel ?? currentProfile.skillLevel,
          isHireable: input.isHireable ?? currentProfile.isHireable
        };
        setProfile(updated);
      }
    }
  });
};
