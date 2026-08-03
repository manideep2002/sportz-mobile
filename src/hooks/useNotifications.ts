import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationService, type NotificationCategory, type NotificationPage } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import type { SportzNotification } from '@/types/domain';

const NOTIFICATIONS_PAGE_SIZE = 40;

export const notificationKeys = {
  all: ['notifications'] as const,
  infinite: (category: NotificationCategory = 'All') => ['notifications', 'infinite', category] as const
};

export const useNotifications = () =>
  useQuery({
    queryKey: notificationKeys.all,
    queryFn: (): Promise<SportzNotification[]> => notificationService.listNotifications(),
    meta: { persist: false }
  });

export const useInfiniteNotifications = (category: NotificationCategory = 'All') =>
  useInfiniteQuery({
    queryKey: notificationKeys.infinite(category),
    queryFn: ({ pageParam }) =>
      notificationService.listNotificationsPage(category, pageParam, NOTIFICATIONS_PAGE_SIZE),
    initialPageParam: undefined as import('@/services/notificationService').NotificationCursor | undefined,
    getNextPageParam: (lastPage: NotificationPage) => lastPage.nextCursor ?? undefined,
    meta: { persist: false }
  });

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  const setNotificationUnreadCount = useUiStore((state) => state.setNotificationUnreadCount);
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      setNotificationUnreadCount(0);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'infinite'] });
    }
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'infinite'] });
    }
  });
};

export const useRealtimeNotifications = (onNewNotification: (notification: SportzNotification) => void) => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const incrementNotificationUnreadCount = useUiStore((state) => state.incrementNotificationUnreadCount);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupSubscription = async () => {
      const sub = await notificationService.subscribeToNotifications((notification, event) => {
        if (!mounted) return;
        queryClient.setQueryData<SportzNotification[]>(notificationKeys.all, (old = []) =>
          [notification, ...old.filter((item) => item.id !== notification.id)].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        queryClient.setQueryData<{
          pages: NotificationPage[];
          pageParams: unknown[];
        }>(notificationKeys.infinite(), (old) =>
          old
            ? {
                ...old,
                pages: [
                  {
                    ...old.pages[0],
                    notifications: [notification, ...(old.pages[0]?.notifications ?? []).filter((item) => item.id !== notification.id)].sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                  },
                  ...old.pages.slice(1).map((page) => ({ ...page, notifications: page.notifications.filter((item) => item.id !== notification.id) }))
                ]
              }
            : { pages: [{ notifications: [notification], nextCursor: null }], pageParams: [undefined] }
        );
        if (event.type === 'INSERT' && !notification.read) {
          incrementNotificationUnreadCount(1);
          onNewNotification(notification);
        } else if (event.type === 'UPDATE' && event.previousRead === false && notification.read) {
          incrementNotificationUnreadCount(-1);
        }
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
  }, [incrementNotificationUnreadCount, onNewNotification, queryClient, userId]);
};
