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

const mapCommunityRow = (row: CommunityRow): Community => ({
  id: row.id,
  type: row.type as Community['type'],
  name: row.name,
  slug: row.slug ?? row.id,
  description: row.description ?? '',
  sport: row.sport,
  city: row.city ?? '',
  isVerified: Boolean(row.is_verified),
  memberCount: row.member_count ?? 0,
  followerCount: row.follower_count ?? 0
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
    return mapCommunityRow(data as CommunityRow);
  }
};
