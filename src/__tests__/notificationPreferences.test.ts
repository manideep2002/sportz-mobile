import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultNotificationPreferences,
  getCachedNotificationSettings,
  hydrateNotificationSettings,
  notificationPreferencesCacheKey,
  saveNotificationPreferences,
  revokePushTokensForCurrentInstallation,
  flushPendingPushRevocations,
  shouldHandleNotification
} from '@/lib/notifications';
import { enIN } from '@/i18n/locales/en-IN';
import { useMessagingStore } from '@/store/messagingStore';

const mockPreferenceUpsert = jest.fn();
const mockPreferenceSelect = jest.fn();
const mockPushRpc = jest.fn();

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
      upsert: mockPreferenceUpsert,
      select: () => ({ eq: () => ({ maybeSingle: mockPreferenceSelect }) })
    })),
    rpc: (...args: unknown[]) => mockPushRpc(...args)
  }
}));

describe('notification preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMessagingStore.setState({ mutedConversations: {} });
    mockPreferenceSelect.mockReset();
    mockPushRpc.mockReset();
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
      notificationPreferencesCacheKey('user-1'),
      JSON.stringify({ enabled: true, preferences: { ...defaultNotificationPreferences, messages: false } })
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
      notificationPreferencesCacheKey('user-1'),
      JSON.stringify({ enabled: true, preferences: { ...defaultNotificationPreferences, follows: false } })
    );

    await expect(shouldHandleNotification({ kind: 'follow_request' })).resolves.toBe(false);
  });

  it('suppresses disabled mention notifications', async () => {
    await AsyncStorage.setItem(
      notificationPreferencesCacheKey('user-1'),
      JSON.stringify({ enabled: true, preferences: { ...defaultNotificationPreferences, mentions: false } })
    );

    await expect(shouldHandleNotification({ kind: 'mention' })).resolves.toBe(false);
  });

  it('suppresses all notifications when push is disabled locally', async () => {
    await AsyncStorage.setItem(
      notificationPreferencesCacheKey('user-1'),
      JSON.stringify({ enabled: false, preferences: defaultNotificationPreferences })
    );

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

  it('keeps two accounts in separate validated local caches', async () => {
    await AsyncStorage.setItem(notificationPreferencesCacheKey('account-a'), JSON.stringify({
      enabled: true,
      preferences: { ...defaultNotificationPreferences, likes: false }
    }));
    await AsyncStorage.setItem(notificationPreferencesCacheKey('account-b'), JSON.stringify({
      enabled: false,
      preferences: { ...defaultNotificationPreferences, messages: false }
    }));

    await expect(getCachedNotificationSettings('account-a')).resolves.toMatchObject({ enabled: true, preferences: { likes: false } });
    await expect(getCachedNotificationSettings('account-b')).resolves.toMatchObject({ enabled: false, preferences: { messages: false } });
  });

  it('removes malformed cache and falls back to server-authoritative settings', async () => {
    await AsyncStorage.setItem(notificationPreferencesCacheKey('account-a'), '{not-json');
    mockPreferenceSelect.mockResolvedValue({
      data: { push_enabled: false, likes: false, comments: true, mentions: true, follows: true, messages: true, events: true, invites: true },
      error: null
    });

    await expect(hydrateNotificationSettings('account-a')).resolves.toMatchObject({ enabled: false, preferences: { likes: false } });
    await expect(AsyncStorage.getItem(notificationPreferencesCacheKey('account-a'))).resolves.toContain('"enabled":false');
  });

  it('uses the same-account cache during an offline server failure', async () => {
    await AsyncStorage.setItem(notificationPreferencesCacheKey('offline-user'), JSON.stringify({
      enabled: true,
      preferences: { ...defaultNotificationPreferences, invites: false }
    }));
    mockPreferenceSelect.mockResolvedValue({ data: null, error: new Error('offline') });

    await expect(hydrateNotificationSettings('offline-user')).resolves.toMatchObject({ preferences: { invites: false } });
  });

  it('rejects failed server saves so the settings screen can roll back and retry', async () => {
    mockPreferenceUpsert.mockResolvedValueOnce({ error: new Error('server unavailable') });

    await expect(saveNotificationPreferences(false, defaultNotificationPreferences)).rejects.toThrow('server unavailable');
  });

  it('queues an offline installation revocation and retries it for the same account', async () => {
    mockPushRpc.mockResolvedValueOnce({ error: new Error('offline') }).mockResolvedValueOnce({ error: null });

    await expect(revokePushTokensForCurrentInstallation('user-1')).rejects.toThrow('offline');
    await flushPendingPushRevocations('user-1');

    expect(mockPushRpc).toHaveBeenCalledWith('revoke_push_installation', expect.objectContaining({ target_device_id: expect.any(String) }));
    expect(mockPushRpc).toHaveBeenCalledTimes(2);
  });
});
