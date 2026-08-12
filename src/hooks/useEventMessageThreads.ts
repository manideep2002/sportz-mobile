import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { eventService } from '@/services/eventService';
import { useAuthStore } from '@/store/authStore';

export const eventMessageThreadKeys = {
  all: ['event-message-threads'] as const
};

export function useEventMessageThreads(enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: eventMessageThreadKeys.all,
    queryFn: () => eventService.listEventMessageThreads(),
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
    refetchOnReconnect: true,
    meta: { persist: false }
  });

  useEffect(() => {
    if (!enabled || !userId) return;
    const subscription = eventService.subscribeToEventMessageThreads(() => {
      void queryClient.invalidateQueries({ queryKey: eventMessageThreadKeys.all });
    });
    return () => subscription.unsubscribe();
  }, [enabled, queryClient, userId]);

  return query;
}
