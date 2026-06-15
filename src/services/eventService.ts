import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { currentUser, events } from '@/data/mockData';
import type { SportEvent } from '@/types/domain';

export interface CreateEventInput {
  title: string;
  sport: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  city: string;
  latitude?: number;
  longitude?: number;
  maxPlayers: number;
  entryFeeCents: number;
  visibility: 'public' | 'group' | 'invite';
}

export const eventService = {
  async listEvents(): Promise<SportEvent[]> {
    if (!env.isSupabaseConfigured) return events;

    const { data, error } = await supabase
      .from('sport_events')
      .select('*, profiles:organizer_id(*)')
      .gte('starts_at', new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
      .order('starts_at', { ascending: true })
      .limit(40);

    if (error || !data) return events;

    const counts = new Map<string, number>();
    const eventIds = data.map((row) => row.id);
    if (eventIds.length) {
      const { data: attendeeRows } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'going');
      attendeeRows?.forEach((attendee) => {
        counts.set(attendee.event_id, (counts.get(attendee.event_id) ?? 0) + 1);
      });
    }

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      sport: row.sport,
      status: row.status,
      description: row.description ?? '',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      locationName: row.location_name,
      city: row.city ?? '',
      latitude: row.latitude ?? 0,
      longitude: row.longitude ?? 0,
      maxPlayers: row.max_players,
      playerCount: counts.get(row.id) ?? 0,
      entryFeeLabel: row.entry_fee_cents > 0 ? `${row.currency} ${row.entry_fee_cents / 100}` : 'Free',
      organizer: {
        ...currentUser,
        id: row.profiles?.id ?? row.organizer_id,
        displayName: row.profiles?.display_name ?? 'Organizer',
        username: row.profiles?.username ?? 'organizer',
        initials: (row.profiles?.display_name ?? 'OR').slice(0, 2).toUpperCase()
      },
      attendees: []
    }));
  },

  async getEvent(eventId: string): Promise<SportEvent> {
    const localEvent = events.find((event) => event.id === eventId) ?? events[0];
    if (!env.isSupabaseConfigured) return localEvent;

    const { data, error } = await supabase
      .from('sport_events')
      .select('*, profiles:organizer_id(*)')
      .eq('id', eventId)
      .single();
    if (error || !data) return localEvent;

    // Fetch attendees
    const { data: attendeeData } = await supabase
      .from('event_attendees')
      .select('user_id, profiles:user_id(*)')
      .eq('event_id', eventId)
      .eq('status', 'going');

    const attendees = (attendeeData ?? []).map((row: any) => ({
      ...currentUser,
      id: row.profiles?.id ?? row.user_id,
      displayName: row.profiles?.display_name ?? 'Athlete',
      username: row.profiles?.username ?? 'athlete',
      initials: (row.profiles?.display_name ?? 'AT')
        .split(' ')
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    }));

    return {
      ...localEvent,
      id: data.id,
      title: data.title,
      sport: data.sport as SportEvent['sport'],
      status: data.status as SportEvent['status'],
      description: data.description ?? '',
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      locationName: data.location_name,
      city: data.city ?? '',
      latitude: data.latitude ?? 0,
      longitude: data.longitude ?? 0,
      maxPlayers: data.max_players,
      playerCount: attendees.length,
      entryFeeLabel: data.entry_fee_cents > 0 ? `${data.currency} ${data.entry_fee_cents / 100}` : 'Free',
      organizer: {
        ...currentUser,
        id: data.profiles?.id ?? data.organizer_id,
        displayName: data.profiles?.display_name ?? 'Organizer',
        username: data.profiles?.username ?? 'organizer',
        initials: (data.profiles?.display_name ?? 'OR').slice(0, 2).toUpperCase()
      },
      attendees
    };
  },

  async createEvent(input: CreateEventInput): Promise<SportEvent> {
    if (!env.isSupabaseConfigured) {
      return {
        id: `local-event-${Date.now()}`,
        title: input.title,
        sport: input.sport as SportEvent['sport'],
        status: 'open',
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        locationName: input.locationName,
        city: input.city,
        latitude: input.latitude ?? 0,
        longitude: input.longitude ?? 0,
        maxPlayers: input.maxPlayers,
        playerCount: 1,
        entryFeeLabel: input.entryFeeCents > 0 ? `INR ${input.entryFeeCents / 100}` : 'Free',
        organizer: currentUser,
        attendees: [currentUser]
      };
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create events.');

    const { data, error } = await supabase
      .from('sport_events')
      .insert({
        organizer_id: authData.user.id,
        title: input.title,
        sport: input.sport,
        description: input.description,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        location_name: input.locationName,
        city: input.city,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        max_players: input.maxPlayers,
        entry_fee_cents: input.entryFeeCents,
        currency: 'INR',
        visibility: input.visibility,
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      title: data.title,
      sport: data.sport as SportEvent['sport'],
      status: data.status as SportEvent['status'],
      description: data.description ?? '',
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      locationName: data.location_name,
      city: data.city ?? '',
      latitude: data.latitude ?? 0,
      longitude: data.longitude ?? 0,
      maxPlayers: data.max_players,
      playerCount: 1,
      entryFeeLabel: data.entry_fee_cents > 0 ? `${data.currency} ${data.entry_fee_cents / 100}` : 'Free',
      organizer: currentUser,
      attendees: [currentUser]
    };
  },

  async joinEvent(eventId: string): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to join events.');

    const { error } = await supabase.from('event_attendees').insert({
      event_id: eventId,
      user_id: authData.user.id,
      status: 'going'
    });
    if (error) throw error;
  },

  async rsvpEvent(eventId: string, status: 'going' | 'interested' | 'declined'): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to RSVP.');

    const { error } = await supabase.from('event_attendees').upsert({
      event_id: eventId,
      user_id: authData.user.id,
      status
    });
    if (error) throw error;
  },

  async leaveEvent(eventId: string): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to leave events.');

    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', authData.user.id);
    if (error) throw error;
  },

  async updateEvent(eventId: string, updates: Partial<CreateEventInput>): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to update events.');

    const updateData: any = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.sport) updateData.sport = updates.sport;
    if (updates.description) updateData.description = updates.description;
    if (updates.startsAt) updateData.starts_at = updates.startsAt;
    if (updates.endsAt) updateData.ends_at = updates.endsAt;
    if (updates.locationName) updateData.location_name = updates.locationName;
    if (updates.city) updateData.city = updates.city;
    if (updates.maxPlayers) updateData.max_players = updates.maxPlayers;
    if (updates.entryFeeCents !== undefined) updateData.entry_fee_cents = updates.entryFeeCents;

    const { error } = await supabase
      .from('sport_events')
      .update(updateData)
      .eq('id', eventId)
      .eq('organizer_id', authData.user.id);
    if (error) throw error;
  },

  async cancelEvent(eventId: string): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to cancel events.');

    const { error } = await supabase
      .from('sport_events')
      .update({ status: 'cancelled' })
      .eq('id', eventId)
      .eq('organizer_id', authData.user.id);
    if (error) throw error;
  },

  async checkUserAttendance(eventId: string): Promise<'going' | 'interested' | 'declined' | null> {
    if (!env.isSupabaseConfigured) return null;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return null;
    if (!authData.user) return null;

    const { data, error } = await supabase
      .from('event_attendees')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data.status as 'going' | 'interested' | 'declined';
  }
};
