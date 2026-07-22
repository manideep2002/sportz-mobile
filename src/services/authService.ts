import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { hotCacheService } from '@/services/hotCacheService';
import { profileService } from '@/services/profileService';
import {
  registrationSchema,
  type RegisterInput
} from '@/schemas/registrationSchema';
import type { UserProfile } from '@/types/domain';

export interface AuthResult {
  session: Session | null;
  user: User | null;
}

export type { RegisterInput } from '@/schemas/registrationSchema';

const SESSION_CACHE_KEY = 'auth:session:v1';
const SESSION_CACHE_TTL_MS = 1000 * 30;

export { normalizeIndianPhoneNumber } from '@/schemas/registrationSchema';

export const authService = {
  async getSession(): Promise<AuthResult> {
    assertSupabaseConfigured();

    return hotCacheService.getOrSet(
      SESSION_CACHE_KEY,
      async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return {
          session: data.session,
          user: data.session?.user ?? null
        };
      },
      { ttlMs: SESSION_CACHE_TTL_MS, persist: false }
    );
  },

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const result = { session: data.session, user: data.user };
    await hotCacheService.set(SESSION_CACHE_KEY, result, { ttlMs: SESSION_CACHE_TTL_MS, persist: false });
    return result;
  },

  async signUp(input: RegisterInput): Promise<AuthResult> {
    assertSupabaseConfigured();

    const parsed = registrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Registration details are invalid.');
    }
    const registration = parsed.data;
    const sports = Array.from(new Set([registration.primarySport, ...registration.secondarySports]));

    const { data, error } = await supabase.auth.signUp({
      email: registration.email,
      password: registration.password,
      options: {
        data: {
          display_name: `${registration.firstName} ${registration.lastName}`,
          username: registration.username,
          city: registration.city,
          mobile_number: registration.mobileNumber,
          date_of_birth: registration.dateOfBirth,
          gender: registration.gender,
          primary_sport: registration.primarySport,
          primary_sport_experience_level: registration.primarySportExperienceLevel,
          secondary_sports: registration.secondarySports,
          sports,
          skill_level: registration.primarySportExperienceLevel
        }
      }
    });
    if (error) throw error;
    const result = { session: data.session, user: data.user };
    await hotCacheService.set(SESSION_CACHE_KEY, result, { ttlMs: SESSION_CACHE_TTL_MS, persist: false });
    return result;
  },

  async signInWithIdToken(provider: 'google' | 'apple', idToken: string): Promise<AuthResult> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken
    });
    if (error) throw error;
    const result = { session: data.session, user: data.user };
    await hotCacheService.set(SESSION_CACHE_KEY, result, { ttlMs: SESSION_CACHE_TTL_MS, persist: false });
    return result;
  },

  async updatePassword(newPassword: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async resetPassword(email: string) {
    assertSupabaseConfigured();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.appScheme}://reset-password`
    });
    if (error) throw error;
  },

  async signOut() {
    assertSupabaseConfigured();

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await hotCacheService.clearAll();
  },

  async deleteAccount() {
    assertSupabaseConfigured();

    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST'
    });
    if (error) throw error;
    await hotCacheService.clearAll();
  },

  async getCurrentProfile(): Promise<UserProfile> {
    assertSupabaseConfigured();

    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError) throw sessionError;
    if (!sessionData.user) throw new Error('You must be signed in to load your profile.');

    return profileService.getProfile(sessionData.user.id);
  },

  async maybeGetCurrentProfile(): Promise<UserProfile | null> {
    assertSupabaseConfigured();

    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError) throw sessionError;
    if (!sessionData.user) return null;

    return profileService.getProfile(sessionData.user.id);
  }
};
