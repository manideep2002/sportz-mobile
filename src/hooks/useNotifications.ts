import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/services/notificationService';
import type { SportzNotification } from '@/types/domain';

const NOTIFICATIONS_PAGE_SIZE = 40;

export const notificationKeys = {
  all: ['notifications'] as const,
  infinite: ['notifications', 'infinite'] as const
};

export const useNotifications = () =>
  useQuery({
    queryKey: notificationKeys.all,
    queryFn: (): Promise<SportzNotification[]> => notificationService.listNotifications()
  });

export const useInfiniteNotifications = () =>
  useInfiniteQuery({
    queryKey: notificationKeys.infinite,
    queryFn: ({ pageParam }) =>
      notificationService.listNotifications(NOTIFICATIONS_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      // Guard against stale or malformed cache entries during hydration
      if (!Array.isArray(lastPage)) return undefined;
      return lastPage.length === NOTIFICATIONS_PAGE_SIZE
        ? lastPageParam + NOTIFICATIONS_PAGE_SIZE
        : undefined;
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
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupSubscription = async () => {
      const sub = await notificationService.subscribeToNotifications((notification) => {
        if (!mounted) return;
        queryClient.setQueryData<SportzNotification[]>(notificationKeys.all, (old = []) => [
          notification,
          ...old.filter((item) => item.id !== notification.id)
        ]);
        queryClient.setQueryData<{
          pages: SportzNotification[][];
          pageParams: unknown[];
        }>(notificationKeys.infinite, (old) =>
          old
            ? {
                ...old,
                pages: [
                  [notification, ...(old.pages[0] ?? []).filter((item) => item.id !== notification.id)],
                  ...old.pages.slice(1)
                ]
              }
            : { pages: [[notification]], pageParams: [0] }
        );
        onNewNotification(notification);
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
  }, [onNewNotification, queryClient]);
};
