import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/data/mockData';
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
  mobileOtp?: string;
  dateOfBirth: string;
  gender: Gender;
  primarySport: Sport;
  primarySportExperienceLevel: SkillLevel;
  secondarySports: Sport[];
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
          mobile_number: input.mobileNumber.trim(),
          mobile_otp_verified: Boolean(input.mobileOtp?.trim()),
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
    return { session: data.session, user: data.user };
  },

  async generateMobileOtp(mobileNumber: string): Promise<{ demoCode?: string }> {
    const phone = mobileNumber.trim();

    if (!phone) {
      throw new Error('Enter a mobile number before generating an OTP.');
    }

    if (!env.isSupabaseConfigured) {
      return { demoCode: '123456' };
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    return {};
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

    // Delegate entirely to profileService — single source of truth for
    // profile mapping AND the real follower/following/posts COUNT queries.
    return profileService.getProfile(sessionData.user.id);
  }
};
