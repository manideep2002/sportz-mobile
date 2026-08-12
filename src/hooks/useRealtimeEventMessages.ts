import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { eventService } from '@/services/eventService';
import { useAuthStore } from '@/store/authStore';
import { eventMessageThreadKeys } from './useEventMessageThreads';

/**
 * App-wide realtime subscription for event messages.
 * Subscribes only once per signed-in user and invalidates the event-message
 * thread query when new accessible event_messages rows are inserted.
 * Reconciles the event thread list after websocket reconnects and
 * app/network foreground/reconnect events.
 */
export const useRealtimeEventMessages = () => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    let hasConnected = false;

    const subscription = eventService.subscribeToEventMessageThreads(
      () => {
        if (!mounted) return;
        // Invalidate the event thread list when new event messages are inserted
        void queryClient.invalidateQueries({ queryKey: eventMessageThreadKeys.all });
      },
      (connected, reconnected) => {
        if (!mounted) return;
        
        // Reconcile after reconnect to ensure thread list is up-to-date
        if (connected && reconnected) {
          void queryClient.invalidateQueries({ queryKey: eventMessageThreadKeys.all });
        }
        
        if (connected) {
          hasConnected = true;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [userId, queryClient]);
};
