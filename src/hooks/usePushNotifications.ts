import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import {
  isNativePlatform,
  registerForPushNotificationsAsync,
  revokePushTokensForCurrentInstallation,
  hydrateNotificationSettings,
  shouldHandleNotification
} from '@/lib/notifications';
import { navigationRef } from '@/navigation/navigationRef';
import {
  openPendingNotificationDestination,
  pendingNotificationDestination,
  type PushNotificationRouteData
} from '@/navigation/notificationRouting';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useRealtimeNotifications } from '@/hooks/useNotifications';
import { captureUnexpectedError } from '@/lib/monitoring';

export const usePushNotifications = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const authStatus = useAuthStore((state) => state.authStatus);
  const setNotificationUnreadCount = useUiStore((state) => state.setNotificationUnreadCount);
  const handleNewRealtimeNotification = useCallback(() => {}, []);

  // Supabase realtime in-app notifications — works on all platforms including web.
  useRealtimeNotifications(handleNewRealtimeNotification);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as PushNotificationRouteData;
      void (async () => {
        if (!(await shouldHandleNotification(data as Record<string, unknown>))) return;
        await pendingNotificationDestination.save(data);
        await openPendingNotificationDestination(navigationRef, authStatus === 'signedIn');
      })();
    },
    [authStatus]
  );

  useEffect(() => {
    if (!userId) {
      setNotificationUnreadCount(0);
      return;
    }

    // Push token registration is native-only; guarded inside the function as well,
    // but the explicit check here makes the intent clear to future readers.
    if (isNativePlatform()) {
      void hydrateNotificationSettings(userId)
        .then(async (settings) => {
          if (settings.enabled) await registerForPushNotificationsAsync();
          else await revokePushTokensForCurrentInstallation(userId);
        })
        .catch((error) => {
          captureUnexpectedError(error, { operation: 'push.preference_reconciliation' });
        });
    }

    void notificationService.countUnread().then(setNotificationUnreadCount).catch((error) => {
      captureUnexpectedError(error, { operation: 'notifications.count_unread' });
    });
  }, [setNotificationUnreadCount, userId]);

  useEffect(() => {
    // All Expo Notifications listener / last-response APIs are unavailable on web.
    // They throw UnavailabilityError during module evaluation on that platform.
    if (!isNativePlatform()) return;

    const foregroundSubscription = Notifications.addNotificationReceivedListener(() => {});
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // getLastNotificationResponseAsync handles the cold-start notification tap.
    // We swallow rejections so an unsupported runtime can never produce an
    // unhandled-promise-rejection (belt-and-suspenders on top of the OS guard above).
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        captureUnexpectedError(error, { operation: 'push.last_response' });
      });

    return () => {
      // Both subscriptions were created together; remove them together.
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleNotificationResponse]);
};
