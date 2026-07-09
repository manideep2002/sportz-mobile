import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { BloomFilter, type SerializedBloomFilter } from '@/utils/bloomFilter';
import { normalizeUsername, validateUsername } from '@/utils/authValidation';

type UsernameAvailabilityStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown';
type UsernameAvailabilitySource = 'empty' | 'validation' | 'bloom' | 'database' | 'cache';

export interface UsernameAvailabilityResult {
  status: UsernameAvailabilityStatus;
  source: UsernameAvailabilitySource;
  username: string;
  message: string;
}

interface UsernameFilterCache {
  version: 1;
  storedAt: string;
  itemCount: number;
  filter: SerializedBloomFilter;
}

interface VerifyOptions {
  forceExact?: boolean;
}

const USERNAME_FILTER_CACHE_KEY = 'SPORTZ_USERNAME_BLOOM_FILTER_V1';
const USERNAME_FILTER_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const USERNAME_BATCH_SIZE = 1000;
const USERNAME_FILTER_FALSE_POSITIVE_RATE = 0.001;
const USERNAME_FILTER_MIN_EXPECTED_ITEMS = 1000;

let usernameFilter: BloomFilter | null = null;
let usernameFilterItemCount = 0;
let hydratePromise: Promise<void> | null = null;

const availableResult = (username: string, source: UsernameAvailabilitySource, message = 'Username is available.'): UsernameAvailabilityResult => ({
  status: 'available',
  source,
  username,
  message
});

const checkingResult = (username: string, source: UsernameAvailabilitySource, message = 'Checking username...'): UsernameAvailabilityResult => ({
  status: 'checking',
  source,
  username,
  message
});

const takenResult = (username: string): UsernameAvailabilityResult => ({
  status: 'taken',
  source: 'database',
  username,
  message: 'That username is already taken.'
});

const parseUsername = (rawUsername: string): UsernameAvailabilityResult | null => {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    return {
      status: 'idle',
      source: 'empty',
      username,
      message: 'Choose a username.'
    };
  }

  try {
    validateUsername(username);
  } catch (error) {
    return {
      status: 'invalid',
      source: 'validation',
      username,
      message: error instanceof Error ? error.message : 'Choose a valid username.'
    };
  }

  return null;
};

const normalizeCurrentUsername = (currentUsername?: string | null) =>
  currentUsername ? normalizeUsername(currentUsername) : '';

const isCurrentUsername = (username: string, currentUsername?: string | null) =>
  Boolean(username && normalizeCurrentUsername(currentUsername) === username);

const readCachedFilter = async () => {
  if (usernameFilter) return true;

  try {
    const cached = await AsyncStorage.getItem(USERNAME_FILTER_CACHE_KEY);
    if (!cached) return false;

    const parsed = JSON.parse(cached) as UsernameFilterCache;
    if (parsed.version !== 1) return false;

    const storedAt = Date.parse(parsed.storedAt);
    if (!Number.isFinite(storedAt) || Date.now() - storedAt > USERNAME_FILTER_CACHE_MAX_AGE_MS) {
      return false;
    }

    usernameFilter = BloomFilter.deserialize(parsed.filter);
    usernameFilterItemCount = parsed.itemCount;
    return true;
  } catch {
    return false;
  }
};

const writeCachedFilter = async () => {
  if (!usernameFilter) return;

  const cache: UsernameFilterCache = {
    version: 1,
    storedAt: new Date().toISOString(),
    itemCount: usernameFilterItemCount,
    filter: usernameFilter.serialize()
  };

  try {
    await AsyncStorage.setItem(USERNAME_FILTER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A missing cache should never block signup or profile editing.
  }
};

const fetchAllUsernames = async () => {
  const usernames: string[] = [];
  let page = 0;

  while (true) {
    const from = page * USERNAME_BATCH_SIZE;
    const to = from + USERNAME_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .order('username', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = (data ?? []) as { username: string | null }[];
    usernames.push(...rows.map((row) => row.username).filter((username): username is string => Boolean(username)));

    if (rows.length < USERNAME_BATCH_SIZE) break;
    page += 1;
  }

  return usernames;
};

const rebuildUsernameFilter = async () => {
  assertSupabaseConfigured();

  const usernames = await fetchAllUsernames();
  const expectedItems = Math.max(usernames.length || 1, USERNAME_FILTER_MIN_EXPECTED_ITEMS);
  usernameFilter = BloomFilter.fromItems(usernames, {
    expectedItems,
    falsePositiveRate: USERNAME_FILTER_FALSE_POSITIVE_RATE
  });
  usernameFilterItemCount = usernames.length;
  await writeCachedFilter();
};

const ensureUsernameFilter = async () => {
  if (usernameFilter) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const hasCachedFilter = await readCachedFilter();
    if (!hasCachedFilter) {
      await rebuildUsernameFilter();
    }
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
};

const checkDatabaseAvailability = async (
  username: string,
  currentUsername?: string | null
): Promise<UsernameAvailabilityResult> => {
  assertSupabaseConfigured();

  if (isCurrentUsername(username, currentUsername)) {
    return availableResult(username, 'database', 'This is your current username.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    usernameFilter?.add(username);
    void writeCachedFilter();
    return takenResult(username);
  }

  return availableResult(username, 'database', 'Username is available.');
};

export const usernameAvailabilityService = {
  warmUsernameFilter: async () => {
    if (usernameFilter) return;
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      await readCachedFilter();
      try {
        await rebuildUsernameFilter();
      } catch {
        // A cached filter or exact database check can still handle the UI path.
      }
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  },

  getInstantAvailability(rawUsername: string, currentUsername?: string | null): UsernameAvailabilityResult {
    const parsed = parseUsername(rawUsername);
    if (parsed) return parsed;

    const username = normalizeUsername(rawUsername);
    if (isCurrentUsername(username, currentUsername)) {
      return availableResult(username, 'bloom', 'This is your current username.');
    }

    if (!usernameFilter) {
      return checkingResult(username, 'cache', 'Preparing instant username checks...');
    }

    return usernameFilter.mightContain(username)
      ? checkingResult(username, 'bloom', 'Verifying username...')
      : availableResult(username, 'bloom', 'Username is available.');
  },

  async verifyUsernameAvailability(
    rawUsername: string,
    currentUsername?: string | null,
    options: VerifyOptions = {}
  ): Promise<UsernameAvailabilityResult> {
    const parsed = parseUsername(rawUsername);
    if (parsed) return parsed;

    const username = normalizeUsername(rawUsername);
    if (isCurrentUsername(username, currentUsername)) {
      return availableResult(username, options.forceExact ? 'database' : 'bloom', 'This is your current username.');
    }

    if (!options.forceExact) {
      try {
        await ensureUsernameFilter();
      } catch {
        return checkDatabaseAvailability(username, currentUsername);
      }

      if (usernameFilter && !usernameFilter.mightContain(username)) {
        return availableResult(username, 'bloom', 'Username is available.');
      }
    }

    return checkDatabaseAvailability(username, currentUsername);
  },

  async rememberUsername(rawUsername: string) {
    const username = normalizeUsername(rawUsername);
    if (!usernameFilter || !username) return;

    const probablyKnown = usernameFilter.mightContain(username);
    usernameFilter.add(username);
    if (!probablyKnown) {
      usernameFilterItemCount += 1;
    }
    await writeCachedFilter();
  },

  clearMemoryCache() {
    usernameFilter = null;
    usernameFilterItemCount = 0;
    hydratePromise = null;
  }
};
