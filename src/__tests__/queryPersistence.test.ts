import type { Query } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(() => jest.fn())
}));

// queryClient installs its NetInfo listener during module evaluation.
// eslint-disable-next-line import/first
import { clearLegacyPersistedQueryCache, shouldPersistQuery } from '@/lib/queryClient';

const query = (queryKey: unknown[], meta?: Record<string, unknown>) =>
  ({ queryKey, meta }) as unknown as Query;

describe('persisted query allowlist', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists only the explicit low-sensitivity public query', () => {
    expect(shouldPersistQuery(query(['search', 'trending-tags']))).toBe(true);
    expect(shouldPersistQuery(query(['search', 'players']))).toBe(false);
  });

  it('never persists messages, notifications, security, private profiles, or account-scoped data', () => {
    expect(shouldPersistQuery(query(['messages', 'conversation-1']))).toBe(false);
    expect(shouldPersistQuery(query(['notifications']))).toBe(false);
    expect(shouldPersistQuery(query(['account-security', 'events']))).toBe(false);
    expect(shouldPersistQuery(query(['profile', 'user-1']))).toBe(false);
    expect(shouldPersistQuery(query(['feed', 'saved']))).toBe(false);
    expect(shouldPersistQuery(query(['search', 'trending-tags'], { persist: false }))).toBe(false);
  });

  it('removes the old broad persisted cache instead of rehydrating private data', async () => {
    await AsyncStorage.setItem('SPORTZ_QUERY_CACHE', JSON.stringify({ clientState: { queries: ['private'] } }));

    await clearLegacyPersistedQueryCache();

    await expect(AsyncStorage.getItem('SPORTZ_QUERY_CACHE')).resolves.toBeNull();
  });
});
