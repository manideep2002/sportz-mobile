import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';

import { storyService } from '@/services/storyService';
import type { Story, UserProfile } from '@/types/domain';

export const storyKeys = {
  all: ['stories'] as const
};

export const useStories = () =>
  useQuery({
    queryKey: storyKeys.all,
    queryFn: storyService.listStories,
    staleTime: 30 * 1000  // prevent background refetch from wiping optimistic story data
  });

export const useCreateStories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assets, author, body }: { assets: ImagePickerAsset[]; author: Pick<UserProfile, 'id' | 'displayName' | 'initials'>; body?: string }) =>
      storyService.createStories(assets, author, body),
    onSuccess: (createdStories) => {
      queryClient.setQueryData<Story[]>(storyKeys.all, (old = []) => [
        ...createdStories,
        ...old.filter((item) => !createdStories.some((story) => story.id === item.id))
      ]);
    }
  });
};

export const useMarkStorySeen = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (storyId: string) => {
      void storyService.markSeen(storyId);
      queryClient.setQueryData<Story[]>(storyKeys.all, (old = []) =>
        old.map((story) => (story.id === storyId ? { ...story, seen: true } : story))
      );
    },
    [queryClient]
  );
};

export const useDeleteStory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) => storyService.deleteStory(storyId),
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({ queryKey: storyKeys.all });
      const previous = queryClient.getQueryData<Story[]>(storyKeys.all);
      // Optimistically remove from cache immediately
      queryClient.setQueryData<Story[]>(storyKeys.all, (old = []) =>
        old.filter((s) => s.id !== storyId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(storyKeys.all, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.all });
    }
  });
};
