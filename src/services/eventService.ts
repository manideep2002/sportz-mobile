import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import { profileService } from '@/services/profileService';
import { storageService } from '@/services/storageService';
import type { EventMessage, SportEvent } from '@/types/domain';

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
  coverImageUri?: string | null;
  maxPlayers: number;
  entryFeeCents: number;
  visibility: 'public' | 'group' | 'invite';
}

/** Shape of a row from `sport_events` with joined organizer profile. */
interface SportEventRow {
  id: string;
  organizer_id: string;
  title: string;
  sport: string;
  status: SportEvent['status'];
  description: string | null;
  cover_url?: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  max_players: number;
  entry_fee_cents: number | null;
  currency: string | null;
  profiles: {
    id: string | null;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    cover_url?: string | null;
    bio?: string | null;
    city?: string | null;
    country?: string | null;
    primary_sport?: string | null;
    sports?: string[] | null;
    skill_level?: string | null;
    is_verified?: boolean | null;
    is_hireable?: boolean | null;
  } | null;
}

/** Shape of an attendee row with joined profile. */
interface AttendeeRow {
  user_id: string;
  profiles: {
    id: string | null;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    city?: string | null;
    country?: string | null;
    primary_sport?: string | null;
    sports?: string[] | null;
    skill_level?: string | null;
    is_verified?: boolean | null;
    is_hireable?: boolean | null;
  } | null;
}

interface EventMessageRow {
  id: string;
  event_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles: SportEventRow['profiles'];
}

const entryFeeLabel = (currency: string | null | undefined, cents: number | null | undefined) =>
  (cents ?? 0) > 0 ? `${currency ?? 'INR'} ${(cents ?? 0) / 100}` : 'Free';

const mapEventRow = (row: SportEventRow, playerCount = 0, attendees: SportEvent['attendees'] = []): SportEvent => ({
  id: row.id,
  title: row.title,
  sport: row.sport,
  status: row.status,
  description: row.description ?? '',
  coverUrl: row.cover_url ?? null,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  locationName: row.location_name,
  city: row.city ?? '',
  latitude: row.latitude ?? 0,
  longitude: row.longitude ?? 0,
  maxPlayers: row.max_players,
  playerCount,
  entryFeeLabel: entryFeeLabel(row.currency, row.entry_fee_cents),
  organizer: mapProfileRow(row.profiles ?? { id: row.organizer_id, display_name: 'Organizer' }),
  attendees
});

export const eventService = {
  async listEvents(): Promise<SportEvent[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('sport_events')
      .select('*, profiles:organizer_id(*)')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(40);

    if (error) throw error;

    const counts = new Map<string, number>();
    const eventIds = (data ?? []).map((row) => row.id);
    if (eventIds.length) {
      const { data: attendeeRows, error: attendeeError } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'going');
      if (attendeeError) throw attendeeError;
      (attendeeRows ?? []).forEach((attendee) => {
        counts.set(attendee.event_id, (counts.get(attendee.event_id) ?? 0) + 1);
      });
    }

    return (data ?? []).map((row) => mapEventRow(row as unknown as SportEventRow, counts.get(row.id) ?? 0));
  },

  async listLiveEvents(): Promise<SportEvent[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('sport_events')
      .select('*, profiles:organizer_id(*)')
      .eq('status', 'live')
      .order('starts_at', { ascending: true })
      .limit(5);
    if (error) throw error;

    return (data ?? []).map((row) => mapEventRow(row as unknown as SportEventRow));
  },

  async getEvent(eventId: string): Promise<SportEvent> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('sport_events')
      .select('*, profiles:organizer_id(*)')
      .eq('id', eventId)
      .single();
    if (error) throw error;

    const { data: attendeeData, error: attendeeError } = await supabase
      .from('event_attendees')
      .select('user_id, profiles:user_id(*)')
      .eq('event_id', eventId)
      .eq('status', 'going');
    if (attendeeError) throw attendeeError;

    const attendees = (attendeeData ?? []).map((row) =>
      mapProfileRow((row as unknown as AttendeeRow).profiles ?? { id: (row as unknown as AttendeeRow).user_id })
    );

    return mapEventRow(data as unknown as SportEventRow, attendees.length, attendees);
  },

  async createEvent(input: CreateEventInput): Promise<SportEvent> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create events.');

    const coverUrl = input.coverImageUri
      ? await storageService.uploadMedia(input.coverImageUri, 'event-covers', authData.user.id)
      : null;

    const { data, error } = await supabase
      .from('sport_events')
      .insert({
        organizer_id: authData.user.id,
        title: input.title,
        sport: input.sport,
        description: input.description,
        cover_url: coverUrl,
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
      .select('*, profiles:organizer_id(*)')
      .single();

    if (error) throw error;

    await supabase.from('event_attendees').upsert({
      event_id: data.id,
      user_id: authData.user.id,
      status: 'going'
    });

    const organizer = await profileService.getProfile(authData.user.id);
    return {
      ...mapEventRow(data as unknown as SportEventRow, 1, [organizer]),
      organizer,
      attendees: [organizer]
    };
  },

  async joinEvent(eventId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to join events.');

    const { error } = await supabase.rpc('join_sport_event', {
      target_event_id: eventId
    });
    if (error) throw error;
  },

  async rsvpEvent(eventId: string, status: 'going' | 'interested' | 'declined'): Promise<void> {
    assertSupabaseConfigured();

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
    assertSupabaseConfigured();

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
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to update events.');

    const updateData: Partial<{
      title: string;
      sport: string;
      description: string;
      starts_at: string;
      ends_at: string;
      location_name: string;
      city: string;
      latitude: number | null;
      longitude: number | null;
      max_players: number;
      entry_fee_cents: number;
    }> = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.sport) updateData.sport = updates.sport;
    if (updates.description) updateData.description = updates.description;
    if (updates.startsAt) updateData.starts_at = updates.startsAt;
    if (updates.endsAt) updateData.ends_at = updates.endsAt;
    if (updates.locationName) updateData.location_name = updates.locationName;
    if (updates.city) updateData.city = updates.city;
    if (updates.latitude !== undefined) updateData.latitude = updates.latitude ?? null;
    if (updates.longitude !== undefined) updateData.longitude = updates.longitude ?? null;
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
    assertSupabaseConfigured();

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
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return null;

    const { data, error } = await supabase
      .from('event_attendees')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.status as 'going' | 'interested' | 'declined' | null;
  },

  /**
   * Batch version of checkUserAttendance — single DB round-trip for any number
   * of events. Returns a Set of event IDs the current user is attending.
   */
  async checkUserAttendanceBatch(eventIds: string[]): Promise<Set<string>> {
    assertSupabaseConfigured();
    if (!eventIds.length) return new Set();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return new Set();

    const { data, error } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', authData.user.id)
      .eq('status', 'going')
      .in('event_id', eventIds);

    if (error) throw error;
    return new Set((data ?? []).map((row: { event_id: string }) => row.event_id));
  },

  async listEventMessages(eventId: string): Promise<EventMessage[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('event_messages')
      .select('*, profiles:sender_id(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((row) => {
      const message = row as unknown as EventMessageRow;
      return {
        id: message.id,
        eventId: message.event_id,
        sender: mapProfileRow(message.profiles ?? { id: message.sender_id }),
        body: message.body,
        createdAt: message.created_at
      };
    });
  },

  async sendEventMessage(eventId: string, body: string): Promise<EventMessage> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to chat.');

    const { data, error } = await supabase
      .from('event_messages')
      .insert({
        event_id: eventId,
        sender_id: authData.user.id,
        body
      })
      .select('*, profiles:sender_id(*)')
      .single();
    if (error) throw error;

    const message = data as unknown as EventMessageRow;
    return {
      id: message.id,
      eventId: message.event_id,
      sender: mapProfileRow(message.profiles ?? { id: message.sender_id }),
      body: message.body,
      createdAt: message.created_at
    };
  },

  subscribeToEventMessages(eventId: string, callback: (message: EventMessage) => void) {
    const channel = supabase
      .channel(`event-messages-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const row = payload.new as { id: string };
          const { data } = await supabase
            .from('event_messages')
            .select('*, profiles:sender_id(*)')
            .eq('id', row.id)
            .single();
          if (!data) return;
          const message = data as unknown as EventMessageRow;
          callback({
            id: message.id,
            eventId: message.event_id,
            sender: mapProfileRow(message.profiles ?? { id: message.sender_id }),
            body: message.body,
            createdAt: message.created_at
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      }
    };
  }
};
