import type { Session, User } from '@supabase/supabase-js';

import type { UserProfile } from '@/types/domain';

const mockGetSession = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockGetAuthProfileState = jest.fn();
const mockCompleteAuthProfile = jest.fn();
const mockClearUserScopedData = jest.fn();

jest.mock('@/services/authService', () => ({
  authService: {
    getSession: () => mockGetSession(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signInWithIdToken: (provider: string, idToken: string) => mockSignInWithIdToken(provider, idToken),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn()
  }
}));

jest.mock('@/services/profileService', () => ({
  profileService: {
    getAuthProfileState: (id: string) => mockGetAuthProfileState(id),
    completeAuthProfile: (id: string, input: unknown) => mockCompleteAuthProfile(id, input)
  }
}));

jest.mock('@/services/sessionDataService', () => ({
  sessionDataService: { clearUserScopedData: () => mockClearUserScopedData() }
}));

// eslint-disable-next-line import/first
import { useAuthStore } from '@/store/authStore';

const createUser = (id: string): User => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: `${id}@example.com`,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2026-07-22T00:00:00.000Z'
} as User);

const createSession = (id: string, token = `token-${id}`): Session => ({
  access_token: token,
  refresh_token: `refresh-${id}`,
  expires_in: 3600,
  expires_at: 1_800_000_000,
  token_type: 'bearer',
  user: createUser(id)
});

const createProfile = (id: string): UserProfile => ({
  id,
  username: `player_${id}`,
  displayName: `Player ${id}`,
  initials: 'PI',
  avatarUrl: null,
  coverUrl: null,
  bio: '',
  city: 'Mumbai',
  country: 'IN',
  primarySport: 'Cricket',
  sports: ['Cricket'],
  skillLevel: 'Intermediate',
  isOnline: false,
  badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClearUserScopedData.mockResolvedValue(undefined);
  useAuthStore.setState({
    session: null,
    user: null,
    profile: null,
    authStatus: 'initializing',
    bootstrapped: false,
    loading: false,
    error: null
  });
});

describe('auth lifecycle synchronization', () => {
  it('loads the profile for INITIAL_SESSION', async () => {
    const session = createSession('initial');
    const profile = createProfile('initial');
    mockGetAuthProfileState.mockResolvedValue({ profile, isComplete: true });

    await useAuthStore.getState().handleAuthStateChange('INITIAL_SESSION', session);

    expect(useAuthStore.getState()).toMatchObject({
      session,
      user: session.user,
      profile,
      authStatus: 'signedIn',
      bootstrapped: true
    });
  });

  it('routes a SIGNED_IN user without a usable profile to completion', async () => {
    const session = createSession('oauth');
    mockGetAuthProfileState.mockResolvedValue({ profile: null, isComplete: false });

    await useAuthStore.getState().handleAuthStateChange('SIGNED_IN', session);

    expect(useAuthStore.getState()).toMatchObject({
      session,
      user: session.user,
      profile: null,
      authStatus: 'profileCompletion'
    });
  });

  it('uses the same synchronized flow for OAuth ID-token sign-in', async () => {
    const session = createSession('google');
    mockSignInWithIdToken.mockResolvedValue({ session });
    mockGetAuthProfileState.mockResolvedValue({ profile: null, isComplete: false });

    await useAuthStore.getState().signInWithIdToken('google', 'id-token');

    expect(mockSignInWithIdToken).toHaveBeenCalledWith('google', 'id-token');
    expect(useAuthStore.getState().authStatus).toBe('profileCompletion');
  });

  it('updates TOKEN_REFRESHED without reloading the profile or resetting auth state', async () => {
    const oldSession = createSession('same', 'old-token');
    const refreshedSession = createSession('same', 'new-token');
    const profile = createProfile('same');
    useAuthStore.setState({
      session: oldSession,
      user: oldSession.user,
      profile,
      authStatus: 'signedIn',
      bootstrapped: true
    });

    await useAuthStore.getState().handleAuthStateChange('TOKEN_REFRESHED', refreshedSession);

    expect(useAuthStore.getState()).toMatchObject({
      session: refreshedSession,
      profile,
      authStatus: 'signedIn'
    });
    expect(mockGetAuthProfileState).not.toHaveBeenCalled();
  });

  it('keeps a refreshed token when an earlier profile load finishes later', async () => {
    const initialSession = createSession('refresh-race', 'old-token');
    const refreshedSession = createSession('refresh-race', 'new-token');
    const profile = createProfile('refresh-race');
    const profileLoad = deferred<{ profile: UserProfile; isComplete: boolean }>();
    mockGetAuthProfileState.mockReturnValueOnce(profileLoad.promise);

    const signIn = useAuthStore.getState().handleAuthStateChange('SIGNED_IN', initialSession);
    await useAuthStore.getState().handleAuthStateChange('TOKEN_REFRESHED', refreshedSession);
    profileLoad.resolve({ profile, isComplete: true });
    await signIn;

    expect(useAuthStore.getState()).toMatchObject({
      session: refreshedSession,
      profile,
      authStatus: 'signedIn'
    });
  });

  it('reloads the profile for USER_UPDATED', async () => {
    const session = createSession('updated');
    const oldProfile = createProfile('updated');
    const newProfile = { ...oldProfile, displayName: 'Updated Player' };
    useAuthStore.setState({
      session,
      user: session.user,
      profile: oldProfile,
      authStatus: 'signedIn',
      bootstrapped: true
    });
    mockGetAuthProfileState.mockResolvedValue({ profile: newProfile, isComplete: true });

    await useAuthStore.getState().handleAuthStateChange('USER_UPDATED', session);

    expect(useAuthStore.getState().profile).toEqual(newProfile);
    expect(useAuthStore.getState().authStatus).toBe('signedIn');
  });

  it('clears auth and user data immediately on SIGNED_OUT', async () => {
    const session = createSession('signed-out');
    useAuthStore.setState({
      session,
      user: session.user,
      profile: createProfile('signed-out'),
      authStatus: 'signedIn',
      bootstrapped: true
    });
    const clearing = deferred<void>();
    mockClearUserScopedData.mockReturnValueOnce(clearing.promise);

    const eventPromise = useAuthStore.getState().handleAuthStateChange('SIGNED_OUT', null);

    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      user: null,
      profile: null,
      authStatus: 'signedOut'
    });
    expect(mockClearUserScopedData).toHaveBeenCalledTimes(1);
    clearing.resolve(undefined);
    await eventPromise;
  });

  it('preserves PASSWORD_RECOVERY routing across USER_UPDATED', async () => {
    const session = createSession('recovery');

    await useAuthStore.getState().handleAuthStateChange('PASSWORD_RECOVERY', session);
    await useAuthStore.getState().handleAuthStateChange('USER_UPDATED', {
      ...session,
      user: { ...session.user, updated_at: '2026-07-22T01:00:00.000Z' }
    });

    expect(useAuthStore.getState().authStatus).toBe('passwordRecovery');
    expect(mockGetAuthProfileState).not.toHaveBeenCalled();
  });

  it('clears the previous account when recovery changes users', async () => {
    const previous = createSession('previous');
    useAuthStore.setState({
      session: previous,
      user: previous.user,
      profile: createProfile('previous'),
      authStatus: 'signedIn',
      bootstrapped: true
    });

    await useAuthStore.getState().handleAuthStateChange('PASSWORD_RECOVERY', createSession('recovery'));

    expect(mockClearUserScopedData).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ profile: null, authStatus: 'passwordRecovery' });
  });

  it('does not let a stale profile request restore state after sign-out', async () => {
    const session = createSession('race');
    const profileLoad = deferred<{ profile: UserProfile; isComplete: boolean }>();
    mockGetAuthProfileState.mockReturnValueOnce(profileLoad.promise);

    const signIn = useAuthStore.getState().handleAuthStateChange('SIGNED_IN', session);
    await useAuthStore.getState().handleAuthStateChange('SIGNED_OUT', null);
    profileLoad.resolve({ profile: createProfile('race'), isComplete: true });
    await signIn;

    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      profile: null,
      authStatus: 'signedOut'
    });
  });

  it('lets a sign-in event win a race with bootstrap', async () => {
    const bootstrapSession = deferred<{ session: Session | null }>();
    const liveSession = createSession('live');
    const profile = createProfile('live');
    mockGetSession.mockReturnValueOnce(bootstrapSession.promise);
    mockGetAuthProfileState.mockResolvedValue({ profile, isComplete: true });

    const bootstrap = useAuthStore.getState().bootstrap();
    await useAuthStore.getState().handleAuthStateChange('SIGNED_IN', liveSession);
    bootstrapSession.resolve({ session: null });
    await bootstrap;

    expect(useAuthStore.getState()).toMatchObject({
      session: liveSession,
      profile,
      authStatus: 'signedIn'
    });
  });

  it('lets a sign-out event win a race with bootstrap', async () => {
    const bootstrapSession = deferred<{ session: Session | null }>();
    mockGetSession.mockReturnValueOnce(bootstrapSession.promise);

    const bootstrap = useAuthStore.getState().bootstrap();
    await useAuthStore.getState().handleAuthStateChange('SIGNED_OUT', null);
    bootstrapSession.resolve({ session: createSession('stale') });
    await bootstrap;

    expect(useAuthStore.getState()).toMatchObject({ session: null, authStatus: 'signedOut' });
    expect(mockGetAuthProfileState).not.toHaveBeenCalled();
  });

  it('clears user-scoped caches when bootstrap cannot restore a session', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('storage unavailable'));

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      profile: null,
      authStatus: 'signedOut',
      error: 'storage unavailable'
    });
    expect(mockClearUserScopedData).toHaveBeenCalledTimes(1);
  });
});
