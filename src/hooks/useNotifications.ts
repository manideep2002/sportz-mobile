import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/services/notificationService';
import type { SportzNotification } from '@/types/domain';

export const notificationKeys = {
  all: ['notifications'] as const,
  infinite: ['notifications', 'infinite'] as const
};

export const useNotifications = () =>
  useQuery({
    queryKey: notificationKeys.all,
    queryFn: async (_ctx: unknown): Promise<SportzNotification[]> => {
      return notificationService.listNotifications();
    }
  });

export const useInfiniteNotifications = () =>
  useQuery({
    queryKey: notificationKeys.infinite,
    queryFn: async (_ctx: unknown): Promise<SportzNotification[]> => {
      const results: SportzNotification[] = [];
      let offset = 0;
      const limit = 40;
      let hasMore = true;

      while (hasMore) {
        const batch = await notificationService.listNotifications(limit, offset);
        if (batch.length === 0) break;
        results.push(...batch);
        if (batch.length < limit) hasMore = false;
        offset += limit;
      }
      return results;
    }
  });

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.infinite });
    }
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.infinite });
    }
  });
};

export const useRealtimeNotifications = (onNewNotification: (notification: SportzNotification) => void) => {
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupSubscription = async () => {
      const sub = await notificationService.subscribeToNotifications((notification) => {
        if (mounted) onNewNotification(notification);
      });
      subscription = sub;
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [onNewNotification]);
};
