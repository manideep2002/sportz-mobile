import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { Community } from '@/types/domain';

/** Shape of a row returned from the `communities` table. */
interface CommunityRow {
  id: string;
  type: Community['type'];
  name: string;
  slug: string | null;
  description: string | null;
  sport: string;
  city: string | null;
  is_verified: boolean | null;
  member_count: number | null;
  follower_count: number | null;
}

export interface CreateCommunityInput {
  name: string;
  type: Community['type'];
  sport: string;
  city: string;
  description: string;
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

const mapCommunityRow = (row: CommunityRow, extras: Partial<Community> = {}): Community => ({
  id: row.id,
  type: row.type as Community['type'],
  name: row.name,
  slug: row.slug ?? row.id,
  description: row.description ?? '',
  sport: row.sport,
  city: row.city ?? '',
  isVerified: Boolean(row.is_verified),
  memberCount: row.member_count ?? 0,
  followerCount: row.follower_count ?? 0,
  ...extras
});

export const communityService = {
  async listCommunities(): Promise<Community[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data ?? []).map((row) => mapCommunityRow(row as CommunityRow));
  },

  async getCommunity(id: string): Promise<Community | null> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [countResult, authResult] = await Promise.all([
      supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', id),
      supabase.auth.getUser()
    ]);
    if (countResult.error) throw countResult.error;

    let role: string | null = null;
    if (authResult.data.user) {
      const { data: memberRow, error: memberError } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', id)
        .eq('user_id', authResult.data.user.id)
        .maybeSingle();
      if (memberError) throw memberError;
      role = memberRow?.role ?? null;
    }

    const liveCount = countResult.count ?? 0;
    return mapCommunityRow(data as CommunityRow, {
      memberCount: liveCount,
      followerCount: liveCount,
      isAdmin: role === 'owner' || role === 'admin',
      isMember: Boolean(role)
    });
  },

  async createCommunity(input: CreateCommunityInput): Promise<Community> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create a community.');

    const { data, error } = await supabase
      .from('communities')
      .insert({
        type: input.type,
        name: input.name.trim(),
        slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
        description: input.description.trim(),
        sport: input.sport,
        city: input.city.trim(),
        created_by: authData.user.id
      })
      .select('*')
      .single();
    if (error) throw error;

    await supabase.from('community_members').insert({
      community_id: data.id,
      user_id: authData.user.id,
      role: 'owner'
    });

    return mapCommunityRow(data as CommunityRow, {
      memberCount: 1,
      followerCount: 1,
      isAdmin: true
    });
  },

  async joinCommunity(communityId: string, role: 'member' | 'follower' = 'member'): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to join.');

    const { error } = await supabase.from('community_members').upsert({
      community_id: communityId,
      user_id: authData.user.id,
      role
    });
    if (error) throw error;
  },

  async leaveCommunity(communityId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to leave.');

    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', authData.user.id);
    if (error) throw error;
  },

  async inviteMember(communityId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.from('community_members').upsert({
      community_id: communityId,
      user_id: userId,
      role: 'member'
    });
    if (error) throw error;
  },

  async listMembers(communityId: string) {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('community_members')
      .select('role, profiles:user_id(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      role: (row as { role: string }).role,
      profile: (row as { profiles: Record<string, any> | null }).profiles
    }));
  }
};
