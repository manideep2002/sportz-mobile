import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { UserProfile } from '@/types/domain';

export type ProfileUpdateInput = Partial<
  Pick<UserProfile, 'username' | 'displayName' | 'avatarUrl' | 'coverUrl' | 'bio' | 'city' | 'primarySport' | 'sports' | 'position' | 'skillLevel' | 'isHireable' | 'isPrivate'>
>;

async function loadProfileCounts(
  userId: string
): Promise<{ followers: number; following: number; posts: number }> {
  const [followersResult, followingResult, postsResult] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
  ]);

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
    posts: postsResult.count ?? 0
  };
}

export const profileService = {
  async getProfile(id: string): Promise<UserProfile> {
    assertSupabaseConfigured();

    const [profileResult, counts] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      loadProfileCounts(id)
    ]);

    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data) throw new Error('Profile not found.');

    return mapProfileRow(profileResult.data, counts);
  },

  async listPlayers(query?: string, sport?: string, page = 0, pageSize = 30): Promise<UserProfile[]> {
    assertSupabaseConfigured();

    const { data: authData } = await supabase.auth.getUser();
    let request = supabase
      .from('profiles')
      .select('*')
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (authData.user) {
      request = request.neq('id', authData.user.id);
    }
    if (query?.trim()) {
      const normalized = query.trim();
      request = request.or(`display_name.ilike.%${normalized}%,username.ilike.%${normalized}%,primary_sport.ilike.%${normalized}%`);
    }
    if (sport?.trim()) {
      request = request.eq('primary_sport', sport.trim());
    }

    const { data, error } = await request;
    if (error) throw error;

    return (data ?? []).map((profile) => mapProfileRow(profile, { followers: 0, following: 0, posts: 0 }));
  },

  async listFollowedIds(profileIds: string[]): Promise<Set<string>> {
    assertSupabaseConfigured();
    if (!profileIds.length) return new Set();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return new Set();

    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authData.user.id)
      .in('following_id', profileIds);
    if (error) throw error;

    return new Set((data ?? []).map((row) => row.following_id as string));
  },

  async updateProfile(id: string, input: ProfileUpdateInput): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: input.displayName,
        username: input.username,
        avatar_url: input.avatarUrl,
        cover_url: input.coverUrl,
        bio: input.bio,
        city: input.city,
        primary_sport: input.primarySport,
        sports: input.sports,
        position: input.position,
        skill_level: input.skillLevel,
        is_hireable: input.isHireable,
        is_private: input.isPrivate,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  async listFollowers(userId: string): Promise<UserProfile[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('follows')
      .select('profiles:follower_id(*)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => mapProfileRow((row as { profiles: Record<string, any> | null }).profiles));
  },

  async listFollowing(userId: string): Promise<UserProfile[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('follows')
      .select('profiles:following_id(*)')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => mapProfileRow((row as { profiles: Record<string, any> | null }).profiles));
  },

  async isFollowing(targetId: string): Promise<boolean> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return false;

    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', authData.user.id)
      .eq('following_id', targetId);

    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async followProfile(profileId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to follow players.');
    if (authData.user.id === profileId) throw new Error('You cannot follow yourself.');

    const { error } = await supabase.from('follows').insert({
      follower_id: authData.user.id,
      following_id: profileId
    });
    if (error && error.code !== '23505') throw error;
  },

  async unfollowProfile(profileId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to unfollow players.');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', authData.user.id)
      .eq('following_id', profileId);

    if (error) throw error;
  }
};
