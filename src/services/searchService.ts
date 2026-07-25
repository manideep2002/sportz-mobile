import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { SearchResult, SkillLevel } from '@/types/domain';

export const SEARCH_PAGE_SIZE = 20;

export interface SearchPage {
  items: SearchResult[];
  /** true when there may be more results to fetch */
  hasMore: boolean;
  /** offset of the next page */
  nextOffset: number;
}

interface SearchRpcRow {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  skill_level: string | null;
}

function mapRpcRow(row: SearchRpcRow): SearchResult {
  return {
    id: row.id,
    type: row.type as SearchResult['type'],
    title: row.title ?? '',
    subtitle: row.subtitle ?? '',
    ...(row.skill_level ? { skillLevel: row.skill_level as SkillLevel } : {})
  };
}

export const searchService = {
  /**
   * Search using the server-side `search_content` RPC.
   *
   * - All user input is passed as bind parameters — no string interpolation.
   * - Type filtering and pagination happen in the database.
   * - Blocked users and private profiles are filtered server-side.
   */
  async search(
    query: string,
    filterType: SearchResult['type'] | undefined,
    offset = 0,
    limit = SEARCH_PAGE_SIZE
  ): Promise<SearchPage> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('search_content', {
      search_query: query,
      filter_type: filterType ?? null,
      result_limit: limit + 1, // fetch one extra to detect hasMore
      result_offset: offset
    });

    if (error) throw error;

    const rows = (data ?? []) as SearchRpcRow[];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(mapRpcRow);

    return {
      items,
      hasMore,
      nextOffset: offset + items.length
    };
  },

  async getTrending(): Promise<string[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('posts')
      .select('body')
      .gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString())
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const counts = new Map<string, number>();
    for (const post of data ?? []) {
      const tags = ((post.body as string).match(/#[A-Za-z0-9_]+/g) ?? []).map((tag: string) =>
        tag.toLowerCase()
      );
      for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }
};
