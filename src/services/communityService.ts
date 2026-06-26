import { supabase } from '@/lib/supabase';
import type { Community } from '@/types/domain';

const mapCommunityRow = (row: any): Community => ({
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
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data ?? []).map(mapCommunityRow);
  },

  async getCommunity(id: string): Promise<Community | null> {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapCommunityRow(data);
  }
};
