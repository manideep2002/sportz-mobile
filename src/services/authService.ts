import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/data/mockData';
import type { UserProfile } from '@/types/domain';

export interface AuthResult {
  session: Session | null;
  user: User | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  city: string;
  primarySport: string;
}

export const authService = {
  async getSession(): Promise<AuthResult> {
    if (!env.isSupabaseConfigured) {
      return { session: null, user: null };
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      session: data.session,
      user: data.session?.user ?? null
    };
  },

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    if (!env.isSupabaseConfigured) {
      return { session: null, user: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  async signUp(input: RegisterInput): Promise<AuthResult> {
    if (!env.isSupabaseConfigured) {
      return { session: null, user: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: `${input.firstName} ${input.lastName}`,
          username: input.username.replace('@', ''),
          city: input.city,
          primary_sport: input.primarySport
        }
      }
    });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  async signInWithIdToken(provider: 'google' | 'apple', idToken: string): Promise<AuthResult> {
    if (!env.isSupabaseConfigured) {
      return { session: null, user: null };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken
    });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  async resetPassword(email: string) {
    if (!env.isSupabaseConfigured) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.appScheme}://reset-password`
    });
    if (error) throw error;
  },

  async signOut() {
    if (!env.isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentProfile(): Promise<UserProfile> {
    if (!env.isSupabaseConfigured) {
      return currentUser;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError) throw sessionError;
    if (!sessionData.user) return currentUser;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionData.user.id)
      .single();

    if (error || !data) return currentUser;

    return {
      ...currentUser,
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      initials: data.display_name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      avatarUrl: data.avatar_url,
      coverUrl: data.cover_url,
      bio: data.bio ?? '',
      city: data.city ?? '',
      country: data.country ?? 'IN',
      primarySport: (data.primary_sport as UserProfile['primarySport']) ?? 'Basketball',
      sports: (data.sports as UserProfile['sports']) ?? ['Basketball'],
      position: data.position ?? undefined,
      skillLevel: (data.skill_level as UserProfile['skillLevel']) ?? 'Intermediate',
      isHireable: data.is_hireable,
      isVerified: data.is_verified
    };
  }
};
