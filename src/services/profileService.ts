import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { hotCacheService } from '@/services/hotCacheService';
import { mapProfileRow } from '@/services/profileMapper';
import type { UserProfile } from '@/types/domain';

export interface FollowRequest {
  id: string;
  requester: UserProfile;
  targetId: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  createdAt: string;
}

export type ProfileUpdateInput = Partial<
  Pick<UserProfile, 'username' | 'displayName' | 'avatarUrl' | 'coverUrl' | 'bio' | 'city' | 'primarySport' | 'sports' | 'position' | 'skillLevel' | 'isHireable' | 'isPrivate'>
>;

const PROFILE_CACHE_TTL_MS = 1000 * 60 * 5;
const profileCacheKey = (id: string) => `profile:v1:${id}`;

const loadProfile = async (id: string): Promise<UserProfile> => {
  const profileResult = await supabase.from('profiles').select('*').eq('id', id).single();

  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) throw new Error('Profile not found.');

  return mapProfileRow(profileResult.data);
};

export const profileService = {
  async getProfile(id: string): Promise<UserProfile> {
    assertSupabaseConfigured();

    return hotCacheService.getOrSet(profileCacheKey(id), () => loadProfile(id), {
      ttlMs: PROFILE_CACHE_TTL_MS
    });
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

    let blockedIds = new Set<string>();
    if (authData.user) {
      const { data: blockRows, error: blockError } = await supabase
        .from('blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${authData.user.id},blocked_id.eq.${authData.user.id}`);
      if (blockError) throw blockError;

      blockedIds = new Set(
        (blockRows ?? []).map((row) =>
          row.blocker_id === authData.user?.id ? (row.blocked_id as string) : (row.blocker_id as string)
        )
      );
    }

    return (data ?? [])
      .filter((profile) => !blockedIds.has(profile.id as string))
      .map((profile) => mapProfileRow(profile, { followers: 0, following: 0, posts: 0 }));
  },

  async listFollowedIds(profileIds: string[]): Promise<Set<string>> {
    assertSupabaseConfigured();
    if (!profileIds.length) return new Set();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return new Set();

    const { data, error } = await supabase
      .from('user_follows')
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
    await hotCacheService.invalidate(profileCacheKey(id));
  },

  async listFollowers(userId: string): Promise<UserProfile[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('user_follows')
      .select('profiles:follower_id(*)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => mapProfileRow((row as { profiles: Record<string, any> | null }).profiles));
  },

  async listFollowing(userId: string): Promise<UserProfile[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('user_follows')
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
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', authData.user.id)
      .eq('following_id', targetId);

    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async followProfile(profileId: string): Promise<'following' | 'requested'> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to follow players.');
    if (authData.user.id === profileId) throw new Error('You cannot follow yourself.');

    const { data, error } = await supabase.rpc('request_or_follow_profile', {
      target_user_id: profileId
    });
    if (error) throw error;
    await Promise.all([
      hotCacheService.invalidate(profileCacheKey(profileId)),
      hotCacheService.invalidate(profileCacheKey(authData.user.id))
    ]);
    return data === 'requested' ? 'requested' : 'following';
  },

  async getFollowRequestStatus(profileId: string): Promise<'pending' | 'approved' | 'declined' | 'cancelled' | null> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return null;

    const { data, error } = await supabase
      .from('follow_requests')
      .select('status')
      .eq('requester_id', authData.user.id)
      .eq('target_id', profileId)
      .maybeSingle();
    if (error && error.code !== '42P01') throw error;

    return (data?.status as 'pending' | 'approved' | 'declined' | 'cancelled' | undefined) ?? null;
  },

  async listIncomingFollowRequests(): Promise<FollowRequest[]> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    const { data, error } = await supabase
      .from('follow_requests')
      .select('id, target_id, status, created_at, requester:requester_id(*)')
      .eq('target_id', authData.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id as string,
      targetId: row.target_id as string,
      status: row.status as FollowRequest['status'],
      createdAt: row.created_at as string,
      requester: mapProfileRow((row as { requester?: Record<string, any> | null }).requester)
    }));
  },

  async respondToFollowRequest(requestId: string, approve: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('respond_to_follow_request', {
      request_id: requestId,
      approve
    });
    if (error) throw error;
    await hotCacheService.invalidateByPrefix('profile:v1:');
  },

  async unfollowProfile(profileId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to unfollow players.');

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', authData.user.id)
      .eq('following_id', profileId);

    if (error) throw error;
    await Promise.all([
      hotCacheService.invalidate(profileCacheKey(profileId)),
      hotCacheService.invalidate(profileCacheKey(authData.user.id))
    ]);
  }
};
