import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { currentUser, users } from '@/data/mockData';
import type { UserProfile } from '@/types/domain';

export type ProfileUpdateInput = Partial<
  Pick<UserProfile, 'displayName' | 'bio' | 'city' | 'primarySport' | 'sports' | 'position' | 'skillLevel' | 'isHireable'>
>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Map a raw `profiles` DB row + computed counts into a UserProfile. */
function mapProfileRow(
  data: Record<string, any>,
  counts: { followers: number; following: number; posts: number }
): UserProfile {
  const displayName: string = data.display_name ?? 'Athlete';
  return {
    ...currentUser,           // safe base — provides optional fields like badges, stats defaults
    id: data.id,
    username: data.username,
    displayName,
    initials: displayName
      .split(' ')
      .map((part: string) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    avatarUrl: data.avatar_url ?? null,
    coverUrl: data.cover_url ?? null,
    bio: data.bio ?? '',
    city: data.city ?? '',
    country: data.country ?? 'IN',
    primarySport: data.primary_sport ?? 'Basketball',
    sports: (data.sports as string[]) ?? ['Basketball'],
    position: data.position ?? undefined,
    skillLevel: data.skill_level ?? 'Intermediate',
    isHireable: data.is_hireable ?? false,
    isVerified: data.is_verified ?? false,
    isOnline: false,
    badges: [],          // no badge column in DB yet — honest empty
    stats: {
      followers: counts.followers,
      following: counts.following,
      posts: counts.posts,
      winRate: 0,        // no win_rate column in DB schema — honest 0
      games: 0,          // no games_played column in DB schema — honest 0
      bestPoints: undefined,
      avgRebounds: undefined
    }
  };
}

/**
 * Run 3 parallel COUNT queries for followers, following, and posts.
 * Returns zeros for any query that fails to avoid a hard crash.
 */
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

// ── Service ──────────────────────────────────────────────────────────────────

export const profileService = {
  async getProfile(id: string): Promise<UserProfile> {
    if (!env.isSupabaseConfigured) {
      return users.find((user) => user.id === id) ?? currentUser;
    }

    const [profileResult, counts] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      loadProfileCounts(id)
    ]);

    if (profileResult.error || !profileResult.data) {
      // Fall back to mock on unexpected DB error
      return users.find((user) => user.id === id) ?? currentUser;
    }

    return mapProfileRow(profileResult.data, counts);
  },

  async listPlayers(query?: string): Promise<UserProfile[]> {
    if (!env.isSupabaseConfigured) {
      const normalized = query?.toLowerCase();
      return normalized
        ? users.filter(
            (user) =>
              user.displayName.toLowerCase().includes(normalized) ||
              user.primarySport.toLowerCase().includes(normalized)
          )
        : users.slice(1);
    }

    let request = supabase.from('profiles').select('*').limit(30);
    if (query) {
      request = request.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    }
    const { data, error } = await request;
    if (error || !data) return users.slice(1);

    // For list views, skip the per-profile count queries (too expensive).
    // Counts will load when the user opens the full profile.
    return data.map((profile) =>
      mapProfileRow(profile, { followers: 0, following: 0, posts: 0 })
    );
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

  async isFollowing(targetId: string): Promise<boolean> {
    if (!env.isSupabaseConfigured) return false;

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', authData.user.id)
      .eq('following_id', targetId);

    return (count ?? 0) > 0;
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
    // Ignore unique violation (already following)
    if (error && error.code !== '23505') throw error;
  },

  async unfollowProfile(profileId: string): Promise<void> {
    if (!env.isSupabaseConfigured) return;

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
