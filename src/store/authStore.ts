import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { authService, type RegisterInput } from '@/services/authService';
import { profileService, type CompleteAuthProfileInput } from '@/services/profileService';
import { sessionDataService } from '@/services/sessionDataService';
import type { UserProfile } from '@/types/domain';

export type AuthStatus =
  | 'initializing'
  | 'signedOut'
  | 'loadingProfile'
  | 'profileCompletion'
  | 'profileError'
  | 'passwordRecovery'
  | 'signedIn';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  authStatus: AuthStatus;
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  handleAuthStateChange: (event: AuthChangeEvent, session: Session | null) => Promise<void>;
  retryProfile: () => Promise<void>;
  completeProfile: (input: CompleteAuthProfileInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signInWithIdToken: (provider: 'google' | 'apple', idToken: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

let authTransitionId = 0;
let pendingProfileSync: { key: string; promise: Promise<void> } | null = null;

const sessionKey = (session: Session) => `${session.user.id}:${session.access_token}`;
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  authStatus: 'initializing',
  bootstrapped: false,
  loading: false,
  error: null,

  bootstrap: async () => {
    if (get().bootstrapped) return;

    const transitionAtStart = authTransitionId;
    set({ authStatus: 'initializing', loading: true, error: null });
    try {
      const { session } = await authService.getSession();
      if (transitionAtStart !== authTransitionId) return;
      await get().handleAuthStateChange('INITIAL_SESSION', session);
    } catch (error) {
      if (transitionAtStart !== authTransitionId) return;
      authTransitionId += 1;
      set({
        session: null,
        user: null,
        profile: null,
        authStatus: 'signedOut',
        bootstrapped: true,
        loading: false,
        error: errorMessage(error, 'Failed to restore session.')
      });
      await sessionDataService.clearUserScopedData();
    }
  },

  handleAuthStateChange: async (event, session) => {
    const current = get();

    if (event === 'PASSWORD_RECOVERY') {
      const switchingUsers = Boolean(current.user && current.user.id !== session?.user.id);
      authTransitionId += 1;
      pendingProfileSync = null;
      set({
        session,
        user: session?.user ?? null,
        profile: switchingUsers ? null : current.profile,
        authStatus: 'passwordRecovery',
        bootstrapped: true,
        loading: false,
        error: null
      });
      if (switchingUsers) await sessionDataService.clearUserScopedData();
      return;
    }

    if (!session || event === 'SIGNED_OUT') {
      const hadUserData = Boolean(current.user || current.profile || current.session) || current.authStatus !== 'signedOut';
      authTransitionId += 1;
      pendingProfileSync = null;
      set({
        session: null,
        user: null,
        profile: null,
        authStatus: 'signedOut',
        bootstrapped: true,
        loading: false,
        error: null
      });
      if (hadUserData) await sessionDataService.clearUserScopedData();
      return;
    }

    const sameUser = current.user?.id === session.user.id;
    if (event === 'TOKEN_REFRESHED' && sameUser) {
      set({ session, user: session.user, bootstrapped: true, error: null });
      return;
    }

    if (event === 'USER_UPDATED' && sameUser && current.authStatus === 'passwordRecovery') {
      set({ session, user: session.user, bootstrapped: true });
      return;
    }

    const key = sessionKey(session);
    if (event !== 'USER_UPDATED' && pendingProfileSync?.key === key) {
      return pendingProfileSync.promise;
    }

    if (
      event !== 'USER_UPDATED' &&
      sameUser &&
      current.session?.access_token === session.access_token &&
      (current.authStatus === 'signedIn' || current.authStatus === 'profileCompletion')
    ) {
      set({ session, user: session.user, bootstrapped: true, loading: false, error: null });
      return;
    }

    const previousUserId = current.user?.id;
    const switchingUsers = Boolean(previousUserId && previousUserId !== session.user.id);
    const backgroundRefresh = sameUser && Boolean(current.profile) && current.authStatus === 'signedIn';
    const transitionId = ++authTransitionId;

    set({
      session,
      user: session.user,
      profile: switchingUsers ? null : current.profile,
      authStatus: backgroundRefresh ? 'signedIn' : 'loadingProfile',
      loading: backgroundRefresh ? current.loading : true,
      error: null
    });

    let promise!: Promise<void>;
    promise = (async () => {
      try {
        if (switchingUsers) await sessionDataService.clearUserScopedData();
        const profileState = await profileService.getAuthProfileState(session.user.id);
        if (transitionId !== authTransitionId) return;
        const liveSession = get().session;
        const resolvedSession = liveSession?.user.id === session.user.id ? liveSession : session;

        set({
          session: resolvedSession,
          user: resolvedSession.user,
          profile: profileState.profile,
          authStatus: profileState.isComplete ? 'signedIn' : 'profileCompletion',
          bootstrapped: true,
          loading: false,
          error: null
        });
      } catch (error) {
        if (transitionId !== authTransitionId) return;
        const message = errorMessage(error, 'Could not load your athlete profile.');
        const liveSession = get().session;
        const resolvedSession = liveSession?.user.id === session.user.id ? liveSession : session;
        if (backgroundRefresh && current.profile) {
          set({ session: resolvedSession, user: resolvedSession.user, authStatus: 'signedIn', bootstrapped: true, loading: false, error: message });
        } else {
          set({
            session: resolvedSession,
            user: resolvedSession.user,
            profile: null,
            authStatus: 'profileError',
            bootstrapped: true,
            loading: false,
            error: message
          });
        }
      } finally {
        if (pendingProfileSync?.promise === promise) pendingProfileSync = null;
      }
    })();

    pendingProfileSync = { key, promise };
    return promise;
  },

  retryProfile: async () => {
    const session = get().session;
    if (!session) return;
    await get().handleAuthStateChange('USER_UPDATED', session);
  },

  completeProfile: async (input) => {
    const user = get().user;
    if (!user) throw new Error('You must be signed in to complete your profile.');

    set({ loading: true, error: null });
    try {
      const profile = await profileService.completeAuthProfile(user.id, input);
      if (get().user?.id !== user.id) return;
      set({ profile, authStatus: 'signedIn', bootstrapped: true, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Could not complete your profile.') });
      throw error;
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { session } = await authService.signInWithPassword(email, password);
      await get().handleAuthStateChange('SIGNED_IN', session);
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Sign in failed.') });
      throw error;
    }
  },

  signUp: async (input) => {
    set({ loading: true, error: null });
    try {
      const { session } = await authService.signUp(input);
      await get().handleAuthStateChange(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Sign up failed.') });
      throw error;
    }
  },

  signInWithIdToken: async (provider, idToken) => {
    set({ loading: true, error: null });
    try {
      const { session } = await authService.signInWithIdToken(provider, idToken);
      await get().handleAuthStateChange('SIGNED_IN', session);
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Social login failed.') });
      throw error;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await authService.resetPassword(email);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Reset failed.') });
      throw error;
    }
  },

  updatePassword: async (newPassword) => {
    set({ loading: true, error: null });
    try {
      await authService.updatePassword(newPassword);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Password update failed.') });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await authService.signOut();
      if (get().authStatus !== 'signedOut') await get().handleAuthStateChange('SIGNED_OUT', null);
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Sign out failed.') });
      throw error;
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null });
    try {
      await authService.deleteAccount();
      if (get().authStatus !== 'signedOut') await get().handleAuthStateChange('SIGNED_OUT', null);
    } catch (error) {
      set({ loading: false, error: errorMessage(error, 'Account deletion failed.') });
      throw error;
    }
  },

  setProfile: (profile) =>
    set((state) => ({
      profile,
      authStatus: state.session ? 'signedIn' : state.authStatus
    }))
}));
