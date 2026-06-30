import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const pushNotificationsEnabledKey = 'sportz.push.enabled';
export const notificationPreferencesKey = 'sportz.notification.preferences';

export type NotificationPreferenceKey = 'likes' | 'comments' | 'follows' | 'events';

export const defaultNotificationPreferences: Record<NotificationPreferenceKey, boolean> = {
  likes: true,
  comments: true,
  follows: true,
  events: true
};

const preferenceForKind = (kind?: string): NotificationPreferenceKey | null => {
  if (kind === 'like') return 'likes';
  if (kind === 'comment') return 'comments';
  if (kind === 'follow') return 'follows';
  if (kind === 'event' || kind === 'invite') return 'events';
  return null;
};

export async function getNotificationPreferences() {
  const saved = await AsyncStorage.getItem(notificationPreferencesKey);
  if (!saved) return defaultNotificationPreferences;
  return {
    ...defaultNotificationPreferences,
    ...(JSON.parse(saved) as Partial<Record<NotificationPreferenceKey, boolean>>)
  };
}

export async function shouldHandleNotification(data: Record<string, unknown>) {
  const enabled = await AsyncStorage.getItem(pushNotificationsEnabledKey);
  if (enabled === 'false') return false;

  const kind = typeof data.kind === 'string' ? data.kind : undefined;
  const preference = preferenceForKind(kind);
  if (!preference) return true;

  const preferences = await getNotificationPreferences();
  return preferences[preference] !== false;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const shouldPresent = await shouldHandleNotification(
      notification.request.content.data as Record<string, unknown>
    );
    return {
      shouldShowAlert: shouldPresent,
      shouldPlaySound: shouldPresent,
      shouldSetBadge: shouldPresent,
      shouldShowBanner: shouldPresent,
      shouldShowList: shouldPresent
    };
  }
});

export async function registerForPushNotificationsAsync() {
  const enabled = await AsyncStorage.getItem(pushNotificationsEnabledKey);
  if (enabled === 'false') return null;

  if (!Device.isDevice) {
    return null;
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (existingPermission.status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5A1F'
    });
  }

  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('push_tokens').upsert(
      {
        user_id: authData.user.id,
        token: token.data,
        platform: Platform.OS,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'token' }
    );
  }

  return token.data;
}
