import AsyncStorage from '@react-native-async-storage/async-storage';

import { hotCacheService } from '@/services/hotCacheService';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('hotCacheService', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
    hotCacheService.clearMemory();
  });

  it('serves memory hits without reloading', async () => {
    const loader = jest.fn(async () => ({ id: 'post-1' }));

    await expect(hotCacheService.getOrSet('post:v1:1:user-1', loader, { ttlMs: 1000 })).resolves.toEqual({
      id: 'post-1'
    });
    await expect(hotCacheService.getOrSet('post:v1:1:user-1', loader, { ttlMs: 1000 })).resolves.toEqual({
      id: 'post-1'
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('hydrates memory from persisted cache', async () => {
    await hotCacheService.set('profile:v1:user-1', { id: 'user-1' }, { ttlMs: 1000 });
    hotCacheService.clearMemory();

    await expect(hotCacheService.get('profile:v1:user-1')).resolves.toEqual({ id: 'user-1' });
  });

  it('reloads expired values', async () => {
    const loader = jest.fn(async () => 'fresh');
    await hotCacheService.set('session:v1', 'stale', { ttlMs: -1 });

    await expect(hotCacheService.getOrSet('session:v1', loader, { ttlMs: 1000, persist: false })).resolves.toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates keys by prefix', async () => {
    await hotCacheService.set('post:v1:1:user-1', 'one', { ttlMs: 1000 });
    await hotCacheService.set('post:v1:2:user-1', 'two', { ttlMs: 1000 });
    await hotCacheService.set('profile:v1:user-1', 'profile', { ttlMs: 1000 });

    await hotCacheService.invalidateByPrefix('post:v1:');

    await expect(hotCacheService.get('post:v1:1:user-1')).resolves.toBeNull();
    await expect(hotCacheService.get('post:v1:2:user-1')).resolves.toBeNull();
    await expect(hotCacheService.get('profile:v1:user-1')).resolves.toBe('profile');
  });
});
