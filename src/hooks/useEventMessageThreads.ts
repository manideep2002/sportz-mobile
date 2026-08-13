import { useQuery } from '@tanstack/react-query';

import { eventService } from '@/services/eventService';
import { useAuthStore } from '@/store/authStore';

export const eventMessageThreadKeys = {
  all: ['event-message-threads'] as const
};

export function useEventMessageThreads(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: eventMessageThreadKeys.all,
    queryFn: () => eventService.listEventMessageThreads(),
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
    refetchOnReconnect: true,
    meta: { persist: false }
  });
}
