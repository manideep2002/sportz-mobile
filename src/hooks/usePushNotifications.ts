import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { registerForPushNotificationsAsync, shouldHandleNotification } from '@/lib/notifications';
import { navigationRef } from '@/navigation/navigationRef';
import { navigateFromNotificationData, type PushNotificationRouteData } from '@/navigation/notificationRouting';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useRealtimeNotifications } from '@/hooks/useNotifications';

export const usePushNotifications = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const setNotificationUnreadCount = useUiStore((state) => state.setNotificationUnreadCount);
  const handleNewRealtimeNotification = useCallback(() => {}, []);

  useRealtimeNotifications(handleNewRealtimeNotification);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as PushNotificationRouteData;
      void (async () => {
        if (!(await shouldHandleNotification(data as Record<string, unknown>))) return;
        navigateFromNotificationData(navigationRef, data);
      })();
    },
    []
  );

  useEffect(() => {
    if (!userId) {
      setNotificationUnreadCount(0);
      return;
    }

    void registerForPushNotificationsAsync().catch(() => {});
    void notificationService.countUnread().then(setNotificationUnreadCount).catch(() => {});
  }, [setNotificationUnreadCount, userId]);

  useEffect(() => {
    const foregroundSubscription = Notifications.addNotificationReceivedListener(() => {});
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleNotificationResponse]);
};
