import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultNotificationPreferences,
  notificationPreferencesKey,
  pushNotificationsEnabledKey,
  saveNotificationPreferences,
  shouldHandleNotification
} from '@/lib/notifications';
import { enIN } from '@/i18n/locales/en-IN';
import { useMessagingStore } from '@/store/messagingStore';

const mockPreferenceUpsert = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn()
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null
      }))
    },
    from: jest.fn(() => ({
      upsert: mockPreferenceUpsert
    }))
  }
}));

describe('notification preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMessagingStore.setState({ mutedConversations: {} });
  });

  it('covers message and invite notification categories', () => {
    expect(defaultNotificationPreferences.messages).toBe(true);
    expect(defaultNotificationPreferences.invites).toBe(true);
    expect(defaultNotificationPreferences.mentions).toBe(true);
  });

  it('describes only the notification channels the product supports', () => {
    expect(enIN.settings.notificationsDetail).toBe('Push and in-app activity alerts');
    expect(enIN.settings.notificationsDetail).not.toMatch(/email/i);
  });

  it('suppresses disabled message notifications', async () => {
    await AsyncStorage.setItem(
      notificationPreferencesKey,
      JSON.stringify({ ...defaultNotificationPreferences, messages: false })
    );

    await expect(shouldHandleNotification({ kind: 'message' })).resolves.toBe(false);
  });

  it('suppresses in-flight notifications for a muted conversation', async () => {
    useMessagingStore.getState().setConversationMutedLocally('muted-room', true);

    await expect(shouldHandleNotification({
      kind: 'chat_message',
      type: 'message',
      conversationId: 'muted-room'
    })).resolves.toBe(false);
  });

  it('treats follow requests as follow notifications', async () => {
    await AsyncStorage.setItem(
      notificationPreferencesKey,
      JSON.stringify({ ...defaultNotificationPreferences, follows: false })
    );

    await expect(shouldHandleNotification({ kind: 'follow_request' })).resolves.toBe(false);
  });

  it('suppresses disabled mention notifications', async () => {
    await AsyncStorage.setItem(
      notificationPreferencesKey,
      JSON.stringify({ ...defaultNotificationPreferences, mentions: false })
    );

    await expect(shouldHandleNotification({ kind: 'mention' })).resolves.toBe(false);
  });

  it('suppresses all notifications when push is disabled locally', async () => {
    await AsyncStorage.setItem(pushNotificationsEnabledKey, 'false');

    await expect(shouldHandleNotification({ kind: 'like' })).resolves.toBe(false);
  });

  it('persists push categories without claiming an email preference channel', async () => {
    mockPreferenceUpsert.mockResolvedValue({ error: null });

    await saveNotificationPreferences(true, {
      ...defaultNotificationPreferences,
      messages: false
    });

    expect(mockPreferenceUpsert).toHaveBeenCalledTimes(1);
    const persisted = mockPreferenceUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted.push_enabled).toBe(true);
    expect(persisted.messages).toBe(false);
    expect(Object.keys(persisted).some((key) => key.toLowerCase().includes('email'))).toBe(false);
  });
});
