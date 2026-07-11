import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const pushNotificationsEnabledKey = 'sportz.push.enabled';
export const notificationPreferencesKey = 'sportz.notification.preferences';
const pushInstallationIdKey = 'sportz.push.installationId';

export type NotificationPreferenceKey =
  | 'likes'
  | 'comments'
  | 'mentions'
  | 'follows'
  | 'messages'
  | 'events'
  | 'invites';

export const defaultNotificationPreferences: Record<NotificationPreferenceKey, boolean> = {
  likes: true,
  comments: true,
  mentions: true,
  follows: true,
  messages: true,
  events: true,
  invites: true
};

const preferenceForKind = (kind?: string): NotificationPreferenceKey | null => {
  if (kind === 'like') return 'likes';
  if (kind === 'comment') return 'comments';
  if (kind === 'mention') return 'mentions';
  if (kind === 'follow' || kind === 'follow_request') return 'follows';
  if (kind === 'message') return 'messages';
  if (kind === 'event') return 'events';
  if (kind === 'invite') return 'invites';
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

export async function saveNotificationPreferences(
  enabled: boolean,
  preferences: Record<NotificationPreferenceKey, boolean>
) {
  await AsyncStorage.setItem(pushNotificationsEnabledKey, String(enabled));
  await AsyncStorage.setItem(notificationPreferencesKey, JSON.stringify(preferences));

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  await supabase.from('notification_preferences').upsert(
    {
      user_id: authData.user.id,
      push_enabled: enabled,
      likes: preferences.likes,
      comments: preferences.comments,
      mentions: preferences.mentions,
      follows: preferences.follows,
      messages: preferences.messages,
      events: preferences.events,
      invites: preferences.invites,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );
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

async function getOrCreateInstallationId() {
  const existing = await AsyncStorage.getItem(pushInstallationIdKey);
  if (existing) return existing;

  const installationId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(pushInstallationIdKey, installationId);
  return installationId;
}

export async function registerForPushNotificationsAsync() {
  const enabled = await AsyncStorage.getItem(pushNotificationsEnabledKey);
  if (enabled === 'false') return null;

  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5A1F'
    });
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

  const runtimeProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const projectId =
    Constants.easConfig?.projectId ??
    (typeof runtimeProjectId === 'string' && runtimeProjectId.trim() ? runtimeProjectId : undefined);
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    const now = new Date().toISOString();
    await supabase.from('user_push_tokens').upsert(
      {
        user_id: authData.user.id,
        expo_push_token: token.data,
        platform: Platform.OS,
        device_id: await getOrCreateInstallationId(),
        device_name: Device.deviceName ?? Device.modelName ?? null,
        app_version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null,
        is_active: true,
        last_seen_at: now,
        revoked_at: null,
        updated_at: now
      },
      { onConflict: 'user_id,expo_push_token' }
    );
  }

  return token.data;
}
