import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { eventService } from '@/services/eventService';
import { useAuthStore } from '@/store/authStore';
import type { EventMessageThread } from '@/types/domain';

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

/**
 * Immediately zeros the unread counter for an event chat in the React Query
 * cache, then persists the read state to the server and invalidates the query.
 * This mirrors the behaviour of `useMarkConversationRead` for player DMs.
 */
export function useMarkEventChatRead(eventId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Optimistically zero the badge — no DB round-trip needed for UX
    queryClient.setQueryData<EventMessageThread[]>(eventMessageThreadKeys.all, (old = []) =>
      old.map((thread) =>
        thread.eventId === eventId ? { ...thread, unreadCount: 0 } : thread
      )
    );

    void (async () => {
      await eventService.markEventChatRead(eventId).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: eventMessageThreadKeys.all });
    })();
  }, [eventId, queryClient]);
}
