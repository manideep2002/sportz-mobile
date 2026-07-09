import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type UsernameAvailabilityStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown';
type UsernameAvailabilitySource = 'empty' | 'validation' | 'bloom' | 'database' | 'cache';

type UsernameAvailabilityResponse = {
  status: UsernameAvailabilityStatus;
  source: UsernameAvailabilitySource;
  username: string;
  message: string;
  exact: boolean;
  filterAgeMs: number | null;
  itemCount: number;
};

type ProfileUsernameRow = {
  username: string | null;
};

type RequestBody = {
  username?: string;
  currentUsername?: string | null;
  forceExact?: boolean;
  remember?: boolean;
  warm?: boolean;
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
const DEFAULT_FALSE_POSITIVE_RATE = 0.001;
const MIN_EXPECTED_ITEMS = 1000;
const HEX_BYTE_LENGTH = 2;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const usernameBatchSize = Number(Deno.env.get('USERNAME_FILTER_BATCH_SIZE') ?? 1000);
const usernameFilterMaxAgeMs = Number(Deno.env.get('USERNAME_FILTER_MAX_AGE_MS') ?? 1000 * 60 * 10);

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS'
};

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return Response.json(body, {
    ...init,
    headers
  });
};

const clampFalsePositiveRate = (rate: number) => Math.min(Math.max(rate, 0.000001), 0.5);

const toPositiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.ceil(value) : fallback;

const optimalBitSize = (expectedItems: number, falsePositiveRate: number) =>
  Math.max(8, Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / Math.LN2 ** 2));

const optimalHashCount = (bitSize: number, expectedItems: number) =>
  Math.max(1, Math.round((bitSize / expectedItems) * Math.LN2));

const fnv1a32 = (value: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

class BloomFilter {
  private readonly bitset: Uint8Array;

  readonly bitSize: number;

  readonly hashCount: number;

  constructor(bitSize: number, hashCount: number) {
    this.bitSize = toPositiveInteger(bitSize, 8);
    this.hashCount = toPositiveInteger(hashCount, 1);
    this.bitset = new Uint8Array(Math.ceil(this.bitSize / 8));
  }

  static create(expectedItems: number, falsePositiveRate = DEFAULT_FALSE_POSITIVE_RATE) {
    const normalizedExpectedItems = toPositiveInteger(expectedItems, 1);
    const bitSize = optimalBitSize(normalizedExpectedItems, clampFalsePositiveRate(falsePositiveRate));
    return new BloomFilter(bitSize, optimalHashCount(bitSize, normalizedExpectedItems));
  }

  add(value: string) {
    for (const position of this.positions(value)) {
      const byteIndex = position >> 3;
      this.bitset[byteIndex] |= 1 << (position & 7);
    }
  }

  mightContain(value: string) {
    for (const position of this.positions(value)) {
      const byteIndex = position >> 3;
      if ((this.bitset[byteIndex] & (1 << (position & 7))) === 0) return false;
    }
    return true;
  }

  private *positions(value: string) {
    const firstHash = fnv1a32(value, 0x811c9dc5);
    const secondHash = fnv1a32(value, firstHash ^ 0x9e3779b9) || 1;

    for (let index = 0; index < this.hashCount; index += 1) {
      const combined = (firstHash + Math.imul(index, secondHash)) >>> 0;
      yield combined % this.bitSize;
    }
  }
}

let usernameFilter: BloomFilter | null = null;
let usernameFilterBuiltAt = 0;
let usernameFilterItemCount = 0;
let usernameFilterBuildPromise: Promise<void> | null = null;

const normalizeUsername = (raw: string) => raw.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);

const filterAgeMs = () => (usernameFilterBuiltAt ? Date.now() - usernameFilterBuiltAt : null);

const responseFor = (
  status: UsernameAvailabilityStatus,
  source: UsernameAvailabilitySource,
  username: string,
  message: string,
  exact: boolean
): UsernameAvailabilityResponse => ({
  status,
  source,
  username,
  message,
  exact,
  filterAgeMs: filterAgeMs(),
  itemCount: usernameFilterItemCount
});

const fetchAllUsernames = async () => {
  const usernames: string[] = [];
  let page = 0;

  while (true) {
    const from = page * usernameBatchSize;
    const to = from + usernameBatchSize - 1;
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .order('username', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = (data ?? []) as ProfileUsernameRow[];
    usernames.push(
      ...rows
        .map((row) => (row.username ? normalizeUsername(row.username) : ''))
        .filter((username) => USERNAME_PATTERN.test(username))
    );

    if (rows.length < usernameBatchSize) break;
    page += 1;
  }

  return usernames;
};

const rebuildUsernameFilter = async () => {
  const usernames = await fetchAllUsernames();
  const filter = BloomFilter.create(Math.max(usernames.length, MIN_EXPECTED_ITEMS), DEFAULT_FALSE_POSITIVE_RATE);

  for (const username of usernames) {
    filter.add(username);
  }

  usernameFilter = filter;
  usernameFilterBuiltAt = Date.now();
  usernameFilterItemCount = usernames.length;
};

const ensureUsernameFilter = async () => {
  const ageMs = filterAgeMs();
  if (usernameFilter && ageMs !== null && ageMs < usernameFilterMaxAgeMs) return;
  if (usernameFilterBuildPromise) return usernameFilterBuildPromise;

  usernameFilterBuildPromise = rebuildUsernameFilter().finally(() => {
    usernameFilterBuildPromise = null;
  });

  return usernameFilterBuildPromise;
};

const exactAvailability = async (username: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const wasProbablyKnown = usernameFilter?.mightContain(username) ?? false;
    usernameFilter?.add(username);
    if (!wasProbablyKnown) usernameFilterItemCount += 1;
    return responseFor('taken', 'database', username, 'That username is already taken.', true);
  }

  return responseFor('available', 'database', username, 'Username is available.', true);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, { status: 405 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  if (body.warm && !body.username) {
    await ensureUsernameFilter();
    return json(responseFor('checking', 'cache', '', 'Username filter is warm.', false));
  }

  const username = normalizeUsername(body.username ?? '');
  if (!username) {
    return json(responseFor('idle', 'empty', username, 'Choose a username.', false));
  }

  if (!USERNAME_PATTERN.test(username)) {
    return json(responseFor('invalid', 'validation', username, 'Username must be 3-30 characters and use only letters, numbers, or underscores.', false));
  }

  const currentUsername = body.currentUsername ? normalizeUsername(body.currentUsername) : '';
  if (currentUsername === username) {
    return json(responseFor('available', body.forceExact ? 'database' : 'bloom', username, 'This is your current username.', Boolean(body.forceExact)));
  }

  if (body.forceExact || body.remember) {
    return json(await exactAvailability(username));
  }

  try {
    await ensureUsernameFilter();
  } catch {
    return json(await exactAvailability(username));
  }

  if (usernameFilter && !usernameFilter.mightContain(username)) {
    return json(responseFor('available', 'bloom', username, 'Username is available.', false));
  }

  return json(await exactAvailability(username));
});
