import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { authService, type RegisterInput } from '@/services/authService';
import type { UserProfile } from '@/types/domain';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signInWithIdToken: (provider: 'google' | 'apple', idToken: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  bootstrapped: false,
  loading: false,
  error: null,

  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const { session, user } = await authService.getSession();
      const profile = user ? await authService.getCurrentProfile() : null;
      set({ session, user, profile, bootstrapped: true, loading: false });
    } catch (error) {
      set({
        session: null,
        user: null,
        profile: null,
        bootstrapped: true,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to restore session.'
      });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { session, user } = await authService.signInWithPassword(email, password);
      const profile = await authService.getCurrentProfile();
      set({ session, user, profile, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Sign in failed.' });
      throw error;
    }
  },

  signUp: async (input) => {
    set({ loading: true, error: null });
    try {
      const { session, user } = await authService.signUp(input);
      const profile = session && user ? await authService.maybeGetCurrentProfile() : null;
      set({ session, user, profile, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Sign up failed.' });
      throw error;
    }
  },

  signInWithIdToken: async (provider, idToken) => {
    set({ loading: true, error: null });
    try {
      const { session, user } = await authService.signInWithIdToken(provider, idToken);
      const profile = await authService.getCurrentProfile();
      set({ session, user, profile, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Social login failed.' });
      throw error;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await authService.resetPassword(email);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Reset failed.' });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await authService.signOut();
      set({ session: null, user: null, profile: null, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Sign out failed.' });
      throw error;
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null });
    try {
      await authService.deleteAccount();
      set({ session: null, user: null, profile: null, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Account deletion failed.' });
      throw error;
    }
  },

  setProfile: (profile) => set({ profile })
}));
