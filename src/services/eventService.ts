import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import { storageService } from '@/services/storageService';
import type { EventCreateVisibility } from '@/constants/events';
import type { EventMessage, EventParticipationStatus, EventType, EventVisibility, SportEvent } from '@/types/domain';

export interface CreateEventInput {
  title: string;
  eventType: EventType;
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
  visibility: EventCreateVisibility;
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'visibility'>> & {
  visibility?: EventVisibility;
};

/** Shape of a row from `sport_events` with joined organizer profile. */
interface SportEventRow {
  id: string;
  organizer_id: string;
  title: string;
  event_type: string | null;
  sport: string;
  status: SportEvent['status'];
  visibility: EventVisibility;
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

export interface EventWaitlistEntry {
  id: string;
  user: SportEvent['attendees'][number];
  status: 'waiting' | 'promoted' | 'cancelled';
  createdAt: string;
}

interface WaitlistRow {
  id: string;
  user_id: string;
  status: EventWaitlistEntry['status'];
  created_at: string;
  profiles: AttendeeRow['profiles'];
}

interface EventMessageRow {
  id: string;
  event_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles: SportEventRow['profiles'];
}

const entryFeeLabel = (currency: string | null | undefined, cents: number | null | undefined) => {
  const feeCents = cents ?? 0;
  if (feeCents <= 0) return 'Free';

  const amount = feeCents / 100;
  return `${currency ?? 'INR'} ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: feeCents % 100 === 0 ? 0 : 2,
    minimumFractionDigits: feeCents % 100 === 0 ? 0 : 2
  })}`;
};

const participationStatuses = new Set<EventParticipationStatus>([
  'none',
  'going',
  'interested',
  'declined',
  'waitlisted'
]);

const participationStatus = (value: unknown): EventParticipationStatus =>
  typeof value === 'string' && participationStatuses.has(value as EventParticipationStatus)
    ? (value as EventParticipationStatus)
    : 'none';

const mapEventRow = (row: SportEventRow, playerCount = 0, attendees: SportEvent['attendees'] = []): SportEvent => ({
  id: row.id,
  title: row.title,
  eventType: (row.event_type ?? 'Pickup Game') as EventType,
  sport: row.sport,
  status: row.status,
  visibility: row.visibility ?? 'public',
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
  entryFeeCents: row.entry_fee_cents ?? 0,
  currency: row.currency ?? 'INR',
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

    const { data: eventId, error } = await supabase.rpc('create_sport_event', {
      target_title: input.title,
      target_event_type: input.eventType,
      target_sport: input.sport,
      target_description: input.description,
      target_cover_url: coverUrl,
      target_starts_at: input.startsAt,
      target_ends_at: input.endsAt,
      target_location_name: input.locationName,
      target_city: input.city,
      target_latitude: input.latitude ?? null,
      target_longitude: input.longitude ?? null,
      target_max_players: input.maxPlayers,
      target_entry_fee_cents: input.entryFeeCents,
      target_visibility: input.visibility
    });

    if (error) throw error;
    if (!eventId || typeof eventId !== 'string') throw new Error('Event was not created.');

    return eventService.getEvent(eventId);
  },

  async joinEvent(eventId: string): Promise<'going' | 'waitlisted'> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to join events.');

    const { data, error } = await supabase.rpc('join_sport_event', {
      target_event_id: eventId
    });
    if (error) throw error;
    return data === 'waitlisted' ? 'waitlisted' : 'going';
  },

  async rsvpEvent(eventId: string, status: 'going' | 'interested' | 'declined'): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to RSVP.');

    const { error } = await supabase.rpc('set_sport_event_rsvp', {
      target_event_id: eventId,
      target_status: status
    });
    if (error) throw error;
  },

  async leaveEvent(eventId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to leave events.');

    const { error } = await supabase.rpc('leave_sport_event', {
      target_event_id: eventId
    });
    if (error) throw error;
  },

  async leaveEventWaitlist(eventId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to leave an event waitlist.');

    const { error } = await supabase.rpc('leave_event_waitlist', {
      target_event_id: eventId
    });
    if (error) throw error;
  },

  async removeAttendee(eventId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('remove_event_attendee', {
      target_event_id: eventId,
      target_user_id: userId
    });
    if (error) throw error;
  },

  async removeWaitlistUser(eventId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('remove_event_waitlist_user', {
      target_event_id: eventId,
      target_user_id: userId
    });
    if (error) throw error;
  },

  async promoteWaitlistUser(eventId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('promote_event_waitlist_user', {
      target_event_id: eventId,
      target_user_id: userId
    });
    if (error) throw error;
  },

  async listWaitlist(eventId: string): Promise<EventWaitlistEntry[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('event_waitlist')
      .select('id, user_id, status, created_at, profiles:user_id(*)')
      .eq('event_id', eventId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row) => {
      const waitlistRow = row as unknown as WaitlistRow;
      return {
        id: waitlistRow.id,
        status: waitlistRow.status,
        createdAt: waitlistRow.created_at,
        user: mapProfileRow(waitlistRow.profiles ?? { id: waitlistRow.user_id })
      };
    });
  },

  async updateEvent(eventId: string, updates: UpdateEventInput): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to update events.');

    const updateData: Partial<{
      title: string;
      event_type: EventType;
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
      visibility: EventVisibility;
    }> = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.eventType) updateData.event_type = updates.eventType;
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
    if (updates.visibility) updateData.visibility = updates.visibility;

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

  async checkUserParticipation(eventId: string): Promise<EventParticipationStatus> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return 'none';

    const { data, error } = await supabase.rpc('get_event_participation_status', {
      target_event_id: eventId
    });

    if (error) throw error;
    return participationStatus(data);
  },

  /**
   * Batch participation lookup. The serializable record is safe for the
   * persisted React Query cache.
   */
  async checkUserParticipationBatch(eventIds: string[]): Promise<Record<string, EventParticipationStatus>> {
    assertSupabaseConfigured();
    const uniqueEventIds = Array.from(new Set(eventIds));
    const statuses = Object.fromEntries(
      uniqueEventIds.map((eventId) => [eventId, 'none' as EventParticipationStatus])
    );
    if (!uniqueEventIds.length) return statuses;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return statuses;

    const { data, error } = await supabase.rpc('get_event_participation_statuses', {
      target_event_ids: uniqueEventIds
    });

    if (error) throw error;
    (data ?? []).forEach((row: unknown) => {
      const result = row as { event_id?: unknown; participation_status?: unknown };
      if (typeof result.event_id === 'string' && result.event_id in statuses) {
        statuses[result.event_id] = participationStatus(result.participation_status);
      }
    });
    return statuses;
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
