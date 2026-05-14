import { communities, courts, events, searchResults, users } from '@/data/mockData';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { SearchResult } from '@/types/domain';

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized || !env.isSupabaseConfigured) {
      return normalized
        ? searchResults.filter((result) => `${result.title} ${result.subtitle}`.toLowerCase().includes(normalized))
        : searchResults;
    }

    const [profiles, sportEvents, sportCourts] = await Promise.all([
      supabase.from('profiles').select('id, display_name, primary_sport, city').ilike('display_name', `%${normalized}%`).limit(10),
      supabase.from('sport_events').select('id, title, sport, location_name').ilike('title', `%${normalized}%`).limit(10),
      supabase.from('courts').select('id, name, sport, city').ilike('name', `%${normalized}%`).limit(10)
    ]);

    if (profiles.error || sportEvents.error || sportCourts.error) {
      return searchResults.filter((result) => `${result.title} ${result.subtitle}`.toLowerCase().includes(normalized));
    }

    return [
      ...(profiles.data ?? []).map((profile) => ({
        id: profile.id,
        type: 'player' as const,
        title: profile.display_name,
        subtitle: `${profile.primary_sport ?? 'Athlete'} - ${profile.city ?? ''}`
      })),
      ...(sportEvents.data ?? []).map((event) => ({
        id: event.id,
        type: 'event' as const,
        title: event.title,
        subtitle: `${event.sport} - ${event.location_name}`
      })),
      ...(sportCourts.data ?? []).map((court) => ({
        id: court.id,
        type: 'court' as const,
        title: court.name,
        subtitle: `${court.sport} - ${court.city}`
      }))
    ];
  },

  getTrending() {
    return ['#BLRBallers', '#WeekendLeague', '#Basketball', '#CourtLife'];
  },

  getLocalIndexes() {
    return { users, events, communities, courts };
  }
};
