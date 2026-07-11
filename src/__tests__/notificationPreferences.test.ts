import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultNotificationPreferences,
  notificationPreferencesKey,
  pushNotificationsEnabledKey,
  shouldHandleNotification
} from '@/lib/notifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn()
}));

describe('notification preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('covers message and invite notification categories', () => {
    expect(defaultNotificationPreferences.messages).toBe(true);
    expect(defaultNotificationPreferences.invites).toBe(true);
    expect(defaultNotificationPreferences.mentions).toBe(true);
  });

  it('suppresses disabled message notifications', async () => {
    await AsyncStorage.setItem(
      notificationPreferencesKey,
      JSON.stringify({ ...defaultNotificationPreferences, messages: false })
    );

    await expect(shouldHandleNotification({ kind: 'message' })).resolves.toBe(false);
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
});
