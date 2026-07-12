import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { hotCacheService } from '@/services/hotCacheService';
import { profileService } from '@/services/profileService';
import type { Gender, SkillLevel, Sport, UserProfile } from '@/types/domain';
import { normalizeUsername, validateUsername } from '@/utils/authValidation';

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
  mobileNumber: string;
  dateOfBirth: string;
  gender: Gender;
  primarySport: Sport;
  primarySportExperienceLevel: SkillLevel;
  secondarySports: Sport[];
}

const SESSION_CACHE_KEY = 'auth:session:v1';
const SESSION_CACHE_TTL_MS = 1000 * 30;

export const normalizeIndianPhoneNumber = (value: string) => {
  const stripped = value.replace(/[\s\-().]/g, '');
  if (!stripped) return '';
  if (stripped.startsWith('+')) return stripped;
  const withoutLeadingZero = stripped.replace(/^0+/, '');
  return `+91${withoutLeadingZero}`;
};

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

    const username = normalizeUsername(input.username);
    validateUsername(username);

    const sports = Array.from(new Set([input.primarySport, ...input.secondarySports]));

    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          display_name: `${input.firstName.trim()} ${input.lastName.trim()}`,
          username,
          city: input.city.trim(),
          mobile_number: normalizeIndianPhoneNumber(input.mobileNumber),
          mobile_otp_verified: false,
          date_of_birth: input.dateOfBirth,
          gender: input.gender,
          primary_sport: input.primarySport,
          primary_sport_experience_level: input.primarySportExperienceLevel,
          secondary_sports: input.secondarySports,
          sports,
          skill_level: input.primarySportExperienceLevel
        }
      }
    });
    if (error) throw error;
    const result = { session: data.session, user: data.user };
    await hotCacheService.set(SESSION_CACHE_KEY, result, { ttlMs: SESSION_CACHE_TTL_MS, persist: false });
    return result;
  },

  async generateMobileOtp(mobileNumber: string): Promise<void> {
    assertSupabaseConfigured();

    const phone = normalizeIndianPhoneNumber(mobileNumber);
    if (!phone) {
      throw new Error('Enter a mobile number before generating an OTP.');
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
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
