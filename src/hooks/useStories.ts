import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { storyService } from '@/services/storyService';
import type { Story, UserProfile } from '@/types/domain';

export const storyKeys = {
  all: ['stories'] as const
};

export const useStories = () =>
  useQuery({
    queryKey: storyKeys.all,
    queryFn: storyService.listStories
  });

export const useCreateStories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaUris, author }: { mediaUris: string[]; author: Pick<UserProfile, 'id' | 'displayName' | 'initials'> }) =>
      storyService.createStories(mediaUris, author),
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
