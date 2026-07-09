import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { normalizeUsername, validateUsername } from '@/utils/authValidation';

type UsernameAvailabilityStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown';
type UsernameAvailabilitySource = 'empty' | 'validation' | 'bloom' | 'database' | 'cache';

export interface UsernameAvailabilityResult {
  status: UsernameAvailabilityStatus;
  source: UsernameAvailabilitySource;
  username: string;
  message: string;
}

interface VerifyOptions {
  forceExact?: boolean;
}

interface EdgeUsernameAvailabilityResult extends UsernameAvailabilityResult {
  exact?: boolean;
  filterAgeMs?: number | null;
  itemCount?: number;
}

interface CachedAvailability {
  result: UsernameAvailabilityResult;
  storedAt: number;
}

const USERNAME_FUNCTION_NAME = 'username-availability';
const USERNAME_AVAILABILITY_CACHE_MAX_AGE_MS = 1000 * 30;

const availabilityCache = new Map<string, CachedAvailability>();
const pendingChecks = new Map<string, Promise<UsernameAvailabilityResult>>();
let warmPromise: Promise<void> | null = null;

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

const cacheKeyFor = (username: string, currentUsername?: string | null) =>
  `${username}:${normalizeCurrentUsername(currentUsername) || 'new'}`;

const readCachedAvailability = (username: string, currentUsername?: string | null) => {
  const cached = availabilityCache.get(cacheKeyFor(username, currentUsername));
  if (!cached) return null;

  if (Date.now() - cached.storedAt > USERNAME_AVAILABILITY_CACHE_MAX_AGE_MS) {
    availabilityCache.delete(cacheKeyFor(username, currentUsername));
    return null;
  }

  return cached.result;
};

const writeCachedAvailability = (result: UsernameAvailabilityResult, currentUsername?: string | null) => {
  if (!result.username || result.status === 'checking' || result.status === 'unknown') return;

  availabilityCache.set(cacheKeyFor(result.username, currentUsername), {
    result,
    storedAt: Date.now()
  });
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
  if (data) return takenResult(username);

  return availableResult(username, 'database', 'Username is available.');
};

const parseEdgeResult = (data: unknown, fallbackUsername: string): UsernameAvailabilityResult => {
  const result = data as Partial<EdgeUsernameAvailabilityResult> | null;
  if (!result || typeof result.status !== 'string') {
    throw new Error('Username availability service returned an invalid response.');
  }

  return {
    status: result.status as UsernameAvailabilityStatus,
    source: (result.source ?? 'database') as UsernameAvailabilitySource,
    username: typeof result.username === 'string' ? result.username : fallbackUsername,
    message: typeof result.message === 'string' ? result.message : 'Could not verify username right now.'
  };
};

const invokeUsernameAvailability = async (
  username: string,
  currentUsername?: string | null,
  options: VerifyOptions & { remember?: boolean } = {}
) => {
  assertSupabaseConfigured();

  const { data, error } = await supabase.functions.invoke(USERNAME_FUNCTION_NAME, {
    body: {
      username,
      currentUsername: normalizeCurrentUsername(currentUsername) || null,
      forceExact: options.forceExact === true,
      remember: options.remember === true
    }
  });

  if (error) throw error;
  return parseEdgeResult(data, username);
};

const checkEdgeAvailability = async (
  username: string,
  currentUsername?: string | null,
  options: VerifyOptions = {}
): Promise<UsernameAvailabilityResult> => {
  const key = `${cacheKeyFor(username, currentUsername)}:${options.forceExact ? 'exact' : 'fast'}`;
  const existing = pendingChecks.get(key);
  if (existing) return existing;

  const promise = invokeUsernameAvailability(username, currentUsername, options)
    .catch(() => checkDatabaseAvailability(username, currentUsername))
    .then((result) => {
      writeCachedAvailability(result, currentUsername);
      return result;
    })
    .finally(() => {
      pendingChecks.delete(key);
    });

  pendingChecks.set(key, promise);
  return promise;
};

export const usernameAvailabilityService = {
  warmUsernameFilter: async () => {
    if (warmPromise) return warmPromise;

    warmPromise = (async () => {
      assertSupabaseConfigured();
      const { error } = await supabase.functions.invoke(USERNAME_FUNCTION_NAME, {
        body: { warm: true }
      });
      if (error) throw error;
    })().catch(() => {
      // Exact verification can still fall back to Postgres if the warm path is unavailable.
    }).finally(() => {
      warmPromise = null;
    });

    return warmPromise;
  },

  getInstantAvailability(rawUsername: string, currentUsername?: string | null): UsernameAvailabilityResult {
    const parsed = parseUsername(rawUsername);
    if (parsed) return parsed;

    const username = normalizeUsername(rawUsername);
    if (isCurrentUsername(username, currentUsername)) {
      return availableResult(username, 'bloom', 'This is your current username.');
    }

    const cached = readCachedAvailability(username, currentUsername);
    if (cached) return cached;

    return checkingResult(username, 'cache', 'Checking edge username cache...');
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
      const cached = readCachedAvailability(username, currentUsername);
      if (cached) return cached;
    }

    return checkEdgeAvailability(username, currentUsername, options);
  },

  async rememberUsername(rawUsername: string) {
    const username = normalizeUsername(rawUsername);
    if (!username) return;

    const result = takenResult(username);
    writeCachedAvailability(result);

    try {
      await invokeUsernameAvailability(username, undefined, { forceExact: true, remember: true });
    } catch {
      // The next warm Edge Function worker rebuild will pick this username up.
    }
  },

  clearMemoryCache() {
    availabilityCache.clear();
    pendingChecks.clear();
    warmPromise = null;
  }
};
