import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { SearchResult } from '@/types/domain';

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    assertSupabaseConfigured();

    const normalized = query.trim();
    const pattern = normalized ? `%${normalized}%` : '%';

    const [profiles, sportEvents, sportCourts, communities] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, primary_sport, city, skill_level')
        .or(`display_name.ilike.${pattern},username.ilike.${pattern},primary_sport.ilike.${pattern}`)
        .limit(10),
      supabase
        .from('sport_events')
        .select('id, title, sport, location_name')
        .or(`title.ilike.${pattern},sport.ilike.${pattern},location_name.ilike.${pattern}`)
        .limit(10),
      supabase
        .from('courts')
        .select('id, name, sport, city')
        .or(`name.ilike.${pattern},sport.ilike.${pattern},city.ilike.${pattern}`)
        .limit(10),
      supabase
        .from('communities')
        .select('id, type, name, sport, city')
        .or(`name.ilike.${pattern},sport.ilike.${pattern},city.ilike.${pattern}`)
        .limit(10)
    ]);

    if (profiles.error) throw profiles.error;
    if (sportEvents.error) throw sportEvents.error;
    if (sportCourts.error) throw sportCourts.error;
    if (communities.error) throw communities.error;

    return [
      ...(profiles.data ?? []).map((profile) => ({
        id: profile.id,
        type: 'player' as const,
        title: profile.display_name,
        subtitle: `${profile.primary_sport ?? 'Athlete'} - ${profile.city ?? ''}`,
        skillLevel: profile.skill_level
      })),
      ...(sportEvents.data ?? []).map((event) => ({
        id: event.id,
        type: 'event' as const,
        title: event.title,
        subtitle: `${event.sport} - ${event.location_name}`
      })),
      ...(communities.data ?? []).map((community) => ({
        id: community.id,
        type: community.type as 'group' | 'page',
        title: community.name,
        subtitle: `${community.sport} - ${community.city ?? ''}`
      })),
      ...(sportCourts.data ?? []).map((court) => ({
        id: court.id,
        type: 'court' as const,
        title: court.name,
        subtitle: `${court.sport} - ${court.city}`
      }))
    ];
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
      const tags = ((post.body as string).match(/#[A-Za-z0-9_]+/g) ?? []).map((tag: string) => tag.toLowerCase());
      for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }
};
