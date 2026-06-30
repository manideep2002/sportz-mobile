import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { registerForPushNotificationsAsync, shouldHandleNotification } from '@/lib/notifications';
import { navigationRef } from '@/navigation/navigationRef';

export const usePushNotifications = () => {
  useEffect(() => {
    void registerForPushNotificationsAsync();
    const foregroundSubscription = Notifications.addNotificationReceivedListener(() => {});
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        entityType?: string;
        entity_type?: string;
        entityId?: string;
        entity_id?: string;
        kind?: string;
      };
      void (async () => {
        if (!(await shouldHandleNotification(data))) return;
        const entityType = data.entityType ?? data.entity_type;
        const entityId = data.entityId ?? data.entity_id;
        if (!navigationRef.isReady() || !entityId) return;
        if (entityType === 'post') {
          navigationRef.navigate('App', { screen: 'PostDetail', params: { postId: entityId } });
        }
        if (entityType === 'event') {
          navigationRef.navigate('App', { screen: 'EventDetail', params: { eventId: entityId } });
        }
        if (entityType === 'profile') {
          navigationRef.navigate('App', { screen: 'UserProfile', params: { userId: entityId } });
        }
        if (entityType === 'conversation') {
          navigationRef.navigate('App', { screen: 'Chat', params: { conversationId: entityId } });
        }
      })();
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);
};
