import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { currentUser, users } from '@/data/mockData';
import type { UserProfile } from '@/types/domain';

export type ProfileUpdateInput = Partial<
  Pick<UserProfile, 'displayName' | 'bio' | 'city' | 'primarySport' | 'sports' | 'position' | 'skillLevel' | 'isHireable'>
>;

export const profileService = {
  async getProfile(id: string): Promise<UserProfile> {
    if (!env.isSupabaseConfigured) {
      return users.find((user) => user.id === id) ?? currentUser;
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;

    return {
      ...currentUser,
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      initials: data.display_name
        .split(' ')
        .map((part: string) => part[0])
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
  },

  async listPlayers(query?: string): Promise<UserProfile[]> {
    if (!env.isSupabaseConfigured) {
      const normalized = query?.toLowerCase();
      return normalized
        ? users.filter((user) => user.displayName.toLowerCase().includes(normalized) || user.primarySport.toLowerCase().includes(normalized))
        : users.slice(1);
    }

    let request = supabase.from('profiles').select('*').limit(30);
    if (query) {
      request = request.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    }
    const { data, error } = await request;
    if (error) throw error;

    return data.map((profile) => ({
      ...currentUser,
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      initials: profile.display_name
        .split(' ')
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      avatarUrl: profile.avatar_url,
      coverUrl: profile.cover_url,
      bio: profile.bio ?? '',
      city: profile.city ?? '',
      country: profile.country ?? 'IN',
      primarySport: (profile.primary_sport as UserProfile['primarySport']) ?? 'Basketball',
      sports: (profile.sports as UserProfile['sports']) ?? ['Basketball'],
      position: profile.position ?? undefined,
      skillLevel: (profile.skill_level as UserProfile['skillLevel']) ?? 'Intermediate',
      isHireable: profile.is_hireable,
      isVerified: profile.is_verified
    }));
  },

  async updateProfile(id: string, input: ProfileUpdateInput): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: input.displayName,
        bio: input.bio,
        city: input.city,
        primary_sport: input.primarySport,
        sports: input.sports,
        position: input.position,
        skill_level: input.skillLevel,
        is_hireable: input.isHireable,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  async followProfile(profileId: string): Promise<void> {
    if (!env.isSupabaseConfigured) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to follow players.');

    const { error } = await supabase.from('follows').insert({
      follower_id: authData.user.id,
      following_id: profileId
    });
    if (error) throw error;
  }
};
