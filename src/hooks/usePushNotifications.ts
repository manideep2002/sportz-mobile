import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { navigationRef } from '@/navigation/navigationRef';

export const usePushNotifications = () => {
  useEffect(() => {
    void registerForPushNotificationsAsync();
    const foregroundSubscription = Notifications.addNotificationReceivedListener(() => {});
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        entityType?: string;
        entityId?: string;
      };
      if (!navigationRef.isReady() || !data.entityId) return;
      if (data.entityType === 'post') {
        navigationRef.navigate('App', { screen: 'PostDetail', params: { postId: data.entityId } });
      }
      if (data.entityType === 'event') {
        navigationRef.navigate('App', { screen: 'EventDetail', params: { eventId: data.entityId } });
      }
      if (data.entityType === 'profile') {
        navigationRef.navigate('App', { screen: 'UserProfile', params: { userId: data.entityId } });
      }
      if (data.entityType === 'conversation') {
        navigationRef.navigate('App', { screen: 'Chat', params: { conversationId: data.entityId } });
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);
};
