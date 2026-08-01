import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useMessagingStore } from '@/store/messagingStore';

/**
 * Returns true only on iOS and Android — the two platforms that support
 * Expo Notifications native APIs. Always false on web.
 */
export const isNativePlatform = (): boolean =>
  Platform.OS === 'ios' || Platform.OS === 'android';

export const pushNotificationsEnabledKey = 'sportz.push.enabled';
export const notificationPreferencesKey = 'sportz.notification.preferences';
const pushInstallationIdKey = 'sportz.push.installationId';
const pendingRevocationsKey = 'sportz.push.pendingRevocations.v1';

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

export interface NotificationSettings {
  enabled: boolean;
  preferences: Record<NotificationPreferenceKey, boolean>;
}

const defaultNotificationSettings = (): NotificationSettings => ({
  enabled: true,
  preferences: { ...defaultNotificationPreferences }
});

export const notificationPreferencesCacheKey = (userId: string) =>
  `${notificationPreferencesKey}:v2:${userId}`;

const parseNotificationSettings = (value: string | null): NotificationSettings | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.enabled !== 'boolean' || !record.preferences || typeof record.preferences !== 'object') return null;
    const preferences = record.preferences as Record<string, unknown>;
    if (!Object.keys(defaultNotificationPreferences).every((key) => typeof preferences[key] === 'boolean')) return null;
    return {
      enabled: record.enabled,
      preferences: Object.fromEntries(
        Object.keys(defaultNotificationPreferences).map((key) => [key, preferences[key]])
      ) as Record<NotificationPreferenceKey, boolean>
    };
  } catch {
    return null;
  }
};

export async function getCachedNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  const key = notificationPreferencesCacheKey(userId);
  const raw = await AsyncStorage.getItem(key);
  const parsed = parseNotificationSettings(raw);
  if (!parsed && raw) await AsyncStorage.removeItem(key);
  return parsed;
}

const cacheNotificationSettings = (userId: string, settings: NotificationSettings) =>
  AsyncStorage.setItem(notificationPreferencesCacheKey(userId), JSON.stringify(settings));

export async function hydrateNotificationSettings(userId: string): Promise<NotificationSettings> {
  const cached = await getCachedNotificationSettings(userId);
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('push_enabled, likes, comments, mentions, follows, messages, events, invites')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (cached) return cached;
    throw error;
  }
  const settings: NotificationSettings = data
    ? {
        enabled: data.push_enabled,
        preferences: {
          likes: data.likes, comments: data.comments, mentions: data.mentions, follows: data.follows,
          messages: data.messages, events: data.events, invites: data.invites
        }
      }
    : defaultNotificationSettings();
  await cacheNotificationSettings(userId, settings);
  return settings;
}

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
  const { data } = await supabase.auth.getUser();
  if (!data.user) return defaultNotificationPreferences;
  return (await getCachedNotificationSettings(data.user.id))?.preferences ?? defaultNotificationPreferences;
}

export async function shouldHandleNotification(data: Record<string, unknown>) {
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user && (await getCachedNotificationSettings(authData.user.id))?.enabled === false) return false;

  const rawKind = typeof data.kind === 'string' ? data.kind : undefined;
  const kind = rawKind === 'chat_message' || data.type === 'message' ? 'message' : rawKind;
  if (kind === 'message') {
    const conversationId = [data.conversationId, data.roomId, data.entityId]
      .find((value): value is string => typeof value === 'string' && Boolean(value));
    if (conversationId && useMessagingStore.getState().mutedConversations[conversationId]) {
      return false;
    }
  }
  const preference = preferenceForKind(kind);
  if (!preference) return true;

  const preferences = await getNotificationPreferences();
  return preferences[preference] !== false;
}

export async function saveNotificationPreferences(
  enabled: boolean,
  preferences: Record<NotificationPreferenceKey, boolean>
) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('You must be signed in to change notification preferences.');

  const { error } = await supabase.from('notification_preferences').upsert(
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
  if (error) throw error;
  await cacheNotificationSettings(authData.user.id, { enabled, preferences });
  if (enabled) {
    await registerForPushNotificationsAsync().catch(() => undefined);
  } else {
    // Preferences were saved server-side. Revocation is queued for the next authenticated retry.
    await revokePushTokensForCurrentInstallation(authData.user.id).catch(() => undefined);
  }
}

export function subscribeToNotificationSettings(
  userId: string,
  onChange: (settings: NotificationSettings) => void
) {
  const channel = supabase
    .channel(`notification-preferences:${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'notification_preferences', filter: `user_id=eq.${userId}`
    }, (payload) => {
      const row = payload.new as Record<string, unknown>;
      if (!row || typeof row.push_enabled !== 'boolean') return;
      const settings = parseNotificationSettings(JSON.stringify({
        enabled: row.push_enabled,
        preferences: Object.fromEntries(Object.keys(defaultNotificationPreferences).map((key) => [key, row[key]]))
      }));
      if (!settings) return;
      void cacheNotificationSettings(userId, settings);
      onChange(settings);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Only register the notification handler on native platforms.
// expo-notifications is unavailable on web and throws UnavailabilityError.
if (isNativePlatform()) {
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
}

async function getOrCreateInstallationId() {
  const existing = await AsyncStorage.getItem(pushInstallationIdKey);
  if (existing) return existing;

  const installationId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(pushInstallationIdKey, installationId);
  return installationId;
}

type PendingRevocation = { userId: string; deviceId: string };
const parsePendingRevocations = (value: string | null): PendingRevocation[] => {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is PendingRevocation => Boolean(item) && typeof item.userId === 'string' && typeof item.deviceId === 'string')
      : [];
  } catch { return []; }
};
const queueRevocation = async (entry: PendingRevocation) => {
  const entries = parsePendingRevocations(await AsyncStorage.getItem(pendingRevocationsKey));
  if (!entries.some((item) => item.userId === entry.userId && item.deviceId === entry.deviceId)) entries.push(entry);
  await AsyncStorage.setItem(pendingRevocationsKey, JSON.stringify(entries));
};

export async function revokePushTokensForCurrentInstallation(expectedUserId?: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const userId = expectedUserId ?? data.user?.id;
  if (!userId || data.user?.id !== userId) return;
  const deviceId = await getOrCreateInstallationId();
  const { error } = await supabase.rpc('revoke_push_installation', { target_device_id: deviceId });
  if (error) {
    await queueRevocation({ userId, deviceId });
    throw error;
  }
}

export async function flushPendingPushRevocations(userId: string): Promise<void> {
  const entries = parsePendingRevocations(await AsyncStorage.getItem(pendingRevocationsKey));
  const remaining: PendingRevocation[] = [];
  for (const entry of entries) {
    if (entry.userId !== userId) { remaining.push(entry); continue; }
    const { error } = await supabase.rpc('revoke_push_installation', { target_device_id: entry.deviceId });
    if (error) remaining.push(entry);
  }
  await AsyncStorage.setItem(pendingRevocationsKey, JSON.stringify(remaining));
}

export async function registerForPushNotificationsAsync() {
  // Push token registration is a native-only feature.
  if (!isNativePlatform()) return null;

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
    await flushPendingPushRevocations(authData.user.id);
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
