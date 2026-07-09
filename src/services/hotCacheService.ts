import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

interface CacheOptions {
  ttlMs: number;
  persist?: boolean;
}

const STORAGE_PREFIX = 'SPORTZ_HOT_CACHE:';
const memoryCache = new Map<string, CacheEntry<unknown>>();

const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const isFresh = (entry: CacheEntry<unknown>) => entry.expiresAt > Date.now();

const safeReadPersisted = async <T>(key: string): Promise<CacheEntry<T> | null> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!isFresh(entry)) {
      await AsyncStorage.removeItem(storageKey(key));
      return null;
    }

    memoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
};

const safeWritePersisted = async <T>(key: string, entry: CacheEntry<T>) => {
  try {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Persisted cache failure should never block a live database response.
  }
};

const safeRemovePersisted = async (key: string) => {
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch {
    // Best-effort invalidation; memory cache is still cleared synchronously.
  }
};

export const hotCacheService = {
  async get<T>(key: string): Promise<T | null> {
    const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memoryEntry) {
      if (isFresh(memoryEntry)) return memoryEntry.value;
      memoryCache.delete(key);
      void safeRemovePersisted(key);
    }

    const persistedEntry = await safeReadPersisted<T>(key);
    return persistedEntry?.value ?? null;
  },

  async set<T>(key: string, value: T, options: CacheOptions): Promise<T> {
    const entry: CacheEntry<T> = {
      value,
      storedAt: Date.now(),
      expiresAt: Date.now() + options.ttlMs
    };

    memoryCache.set(key, entry);
    if (options.persist !== false) {
      await safeWritePersisted(key, entry);
    }

    return value;
  },

  async getOrSet<T>(key: string, loader: () => Promise<T>, options: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const loaded = await loader();
    return this.set(key, loaded, options);
  },

  async invalidate(key: string) {
    memoryCache.delete(key);
    await safeRemovePersisted(key);
  },

  async invalidateByPrefix(prefix: string) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }

    try {
      const keys = await AsyncStorage.getAllKeys();
      const matchingKeys = keys.filter((key) => key.startsWith(storageKey(prefix)));
      if (matchingKeys.length) await AsyncStorage.multiRemove(matchingKeys);
    } catch {
      // Persisted cache cleanup is best effort.
    }
  },

  async clearAll() {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const matchingKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
      if (matchingKeys.length) await AsyncStorage.multiRemove(matchingKeys);
    } catch {
      // Persisted cache cleanup is best effort.
    }
  },

  clearMemory() {
    memoryCache.clear();
  }
};
