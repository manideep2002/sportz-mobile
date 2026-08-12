import { supabase } from '@/lib/supabase';
import { formatLocalizedCurrency, i18n } from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import { storageService } from '@/services/storageService';
import { captureUnexpectedError } from '@/lib/monitoring';
import type { EventCreateVisibility } from '@/constants/events';
import type { EventInvitation, EventInvitationStatus, EventMessage, EventMessageThread, EventParticipationStatus, EventType, EventVisibility, SportEvent } from '@/types/domain';
import { createUuid } from '@/utils/uuid';

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
  communityId?: string;
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'visibility' | 'communityId'>> & {
  visibility?: EventVisibility;
};

/** Shape of a row from `sport_events` with joined organizer profile. */
interface SportEventRow {
  id: string;
  organizer_id: string;
  community_id?: string | null;
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

export interface EventMessageCursor {
  createdAt: string;
  id: string;
}

export interface EventMessagePage {
  messages: EventMessage[];
  nextCursor: EventMessageCursor | null;
}

interface EventMessageThreadRow {
  event_id: string;
  title: string;
  sport: string;
  cover_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface EventListCursor {
  startsAt: string;
  id: string;
}

export interface EventListPage {
  events: SportEvent[];
  nextCursor: EventListCursor | null;
}

export const EVENT_LIST_PAGE_SIZE = 40;

export const EVENT_MESSAGE_PAGE_SIZE = 50;

const newestEventMessageFirst = (a: EventMessage, b: EventMessage) => {
  const byCreatedAt = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return byCreatedAt || b.id.localeCompare(a.id);
};

/** Reconciles optimistic, mutation-response, reconnect, and realtime copies. */
export function mergeEventMessages(
  current: EventMessage[],
  incoming: EventMessage | EventMessage[]
) {
  const merged = new Map(current.map((message) => [message.id, message]));
  const updates = Array.isArray(incoming) ? incoming : [incoming];
  updates.forEach((message) => {
    merged.set(message.id, { ...merged.get(message.id), ...message });
  });
  return [...merged.values()].sort(newestEventMessageFirst);
}

const mapEventMessageRow = (message: EventMessageRow): EventMessage => ({
  id: message.id,
  eventId: message.event_id,
  sender: mapProfileRow(message.profiles ?? { id: message.sender_id }),
  body: message.body,
  createdAt: message.created_at,
  deliveryStatus: 'sent'
});

const entryFeeLabel = (currency: string | null | undefined, cents: number | null | undefined) => {
  const feeCents = cents ?? 0;
  if (feeCents <= 0) return i18n.t('common.free');

  const amount = feeCents / 100;
  return formatLocalizedCurrency(amount, currency ?? 'INR');
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
  attendees,
  communityId: row.community_id ?? null
});

/**
 * Best-effort deletion of a cover that was uploaded but never successfully
 * attached to an event. Idempotent (no-op when there is nothing to remove;
 * removing a missing storage object is also a no-op) and observable: cleanup
 * failures are reported to monitoring but never replace the triggering error.
 */
async function cleanupUnattachedCover(coverUrl: string | null): Promise<void> {
  if (!coverUrl) return;
  try {
    await storageService.removeEventCover(coverUrl);
  } catch (cleanupError) {
    captureUnexpectedError(cleanupError, {
      operation: 'event.coverCleanup',
      extra: { coverUrl }
    });
  }
}

export const eventService = {
  async listEvents(): Promise<SportEvent[]> {
    return (await eventService.listEventsPage()).events;
  },

  async listEventsPage(cursor?: EventListCursor, limit = EVENT_LIST_PAGE_SIZE): Promise<EventListPage> {
    assertSupabaseConfigured();

    let request = supabase
      .from('sport_events')
      .select('*, profiles:organizer_id(*)')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .order('id', { ascending: true });
    if (cursor) {
      request = request.or(`starts_at.gt.${cursor.startsAt},and(starts_at.eq.${cursor.startsAt},id.gt.${cursor.id})`);
    }
    const { data, error } = await request.limit(limit + 1);

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

    const rows = (data ?? []) as unknown as SportEventRow[];
    const pageRows = rows.slice(0, limit);
    return {
      events: pageRows.map((row) => mapEventRow(row, counts.get(row.id) ?? 0)),
      nextCursor: rows.length > limit && pageRows.length
        ? { startsAt: pageRows[pageRows.length - 1].starts_at, id: pageRows[pageRows.length - 1].id }
        : null
    };
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

  async listCommunityEvents(communityId: string): Promise<SportEvent[]> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('list_community_sport_events', {
      target_community_id: communityId
    });
    if (error) throw error;
    const rows = (data ?? []) as SportEventRow[];
    return rows.map((row) => mapEventRow(row));
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

  async createEvent(input: CreateEventInput, signal?: AbortSignal): Promise<SportEvent> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create events.');

    const coverUrl = input.coverImageUri
      ? await storageService.uploadMedia(input.coverImageUri, 'event-covers', authData.user.id)
      : null;

    let createRequest = supabase.rpc('create_sport_event', {
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
      target_visibility: input.visibility,
      target_community_id: input.communityId ?? null
    });
    if (signal) createRequest = createRequest.abortSignal(signal);

    const { data: eventId, error } = await createRequest;

    if (error || !eventId || typeof eventId !== 'string') {
      // The event row was never created, so the uploaded cover is unreferenced.
      await cleanupUnattachedCover(coverUrl);
      if (error) throw error;
      throw new Error('Event was not created.');
    }

    return eventService.getEvent(eventId);
  },

  async inviteToEvent(eventId: string, userId: string, expiresAt?: string): Promise<string> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('create_event_invitation', {
      target_event_id: eventId,
      target_invitee_id: userId,
      target_expires_at: expiresAt ?? null
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Invitation was not created.');
    return data;
  },

  async respondToEventInvitation(invitationId: string, accept: boolean): Promise<'going' | 'waitlisted' | 'declined' | 'expired' | 'accepted'> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('respond_to_event_invitation', {
      target_invitation_id: invitationId,
      accept_invitation: accept
    });
    if (error) throw error;
    if (data === 'waitlisted' || data === 'declined' || data === 'expired' || data === 'accepted') return data;
    return 'going';
  },

  async revokeEventInvitation(invitationId: string): Promise<void> {
    assertSupabaseConfigured();
    const { error } = await supabase.rpc('revoke_event_invitation', { target_invitation_id: invitationId });
    if (error) throw error;
  },

  async getMyEventInvitation(eventId: string): Promise<EventInvitation | null> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('get_my_event_invitation', { target_event_id: eventId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row.id !== 'string' || typeof row.status !== 'string' || typeof row.expires_at !== 'string') return null;
    return { id: row.id, eventId, status: row.status as EventInvitationStatus, expiresAt: row.expires_at };
  },

  async listEventInvitations(eventId: string): Promise<EventInvitation[]> {
    assertSupabaseConfigured();
    const { data, error } = await supabase
      .from('event_invitations')
      .select('id, event_id, status, expires_at, invitee:invitee_id(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const invitee = row.invitee as unknown as AttendeeRow['profiles'];
      return {
        id: row.id as string,
        eventId: row.event_id as string,
        status: row.status as EventInvitationStatus,
        expiresAt: row.expires_at as string,
        invitee: invitee ? mapProfileRow(invitee) : undefined
      };
    });
  },

  async joinEvent(eventId: string): Promise<'going' | 'waitlisted'> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      captureUnexpectedError(authError, {
        operation: 'event.join',
        extra: { eventId }
      });
      throw authError;
    }
    if (!authData.user) throw new Error('You must be signed in to join events.');

    const { data, error } = await supabase.rpc('join_sport_event', {
      target_event_id: eventId
    });
    if (error) {
      captureUnexpectedError(error, {
        operation: 'event.join',
        extra: { eventId }
      });
      throw error;
    }
    return data === 'waitlisted' ? 'waitlisted' : 'going';
  },

  async rsvpEvent(eventId: string, status: 'going' | 'interested' | 'declined'): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      captureUnexpectedError(authError, { operation: 'event.rsvp', extra: { eventId, status } });
      throw authError;
    }
    if (!authData.user) throw new Error('You must be signed in to RSVP.');

    const { error } = await supabase.rpc('set_sport_event_rsvp', {
      target_event_id: eventId,
      target_status: status
    });
    if (error) {
      captureUnexpectedError(error, { operation: 'event.rsvp', extra: { eventId, status } });
      throw error;
    }
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


  async updateEvent(eventId: string, updates: UpdateEventInput): Promise<SportEvent> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to update events.');

    const { data: existing, error: existingError } = await supabase
      .from('sport_events')
      .select('cover_url')
      .eq('id', eventId)
      .single();
    if (existingError) throw existingError;

    let uploadedCoverUrl: string | null = null;
    if (typeof updates.coverImageUri === 'string') {
      uploadedCoverUrl = await storageService.uploadMedia(updates.coverImageUri, 'event-covers', authData.user.id);
    }

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
      cover_url: string | null;
    }> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.eventType !== undefined) updateData.event_type = updates.eventType;
    if (updates.sport !== undefined) updateData.sport = updates.sport;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.startsAt !== undefined) updateData.starts_at = updates.startsAt;
    if (updates.endsAt !== undefined) updateData.ends_at = updates.endsAt;
    if (updates.locationName !== undefined) updateData.location_name = updates.locationName;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.latitude !== undefined) updateData.latitude = updates.latitude ?? null;
    if (updates.longitude !== undefined) updateData.longitude = updates.longitude ?? null;
    if (updates.maxPlayers !== undefined) updateData.max_players = updates.maxPlayers;
    if (updates.entryFeeCents !== undefined) updateData.entry_fee_cents = updates.entryFeeCents;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
    if (updates.coverImageUri !== undefined) updateData.cover_url = uploadedCoverUrl;

    try {
      const { data: updatedEvent, error } = await supabase
        .from('sport_events')
        .update(updateData)
        .eq('id', eventId)
        .select('id')
        .single();
      if (error) throw error;
      if (!updatedEvent) throw new Error('You are not authorized to update this event.');
    } catch (error) {
      // The database update remains authoritative. A failed cleanup must not hide its error.
      await cleanupUnattachedCover(uploadedCoverUrl);
      throw error;
    }

    if (updates.coverImageUri !== undefined && existing.cover_url && existing.cover_url !== uploadedCoverUrl) {
      // The replacement is persisted; stale storage can be cleaned up later without rolling it back.
      await cleanupUnattachedCover(existing.cover_url);
    }

    return this.getEvent(eventId);
  },

  async cancelEvent(eventId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to cancel events.');

    const { data, error } = await supabase
      .from('sport_events')
      .update({ status: 'cancelled' })
      .eq('id', eventId)
      .select('id')
      .single();
    if (error) throw error;
    if (!data) throw new Error('You are not authorized to cancel this event.');
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

  async listEventMessages(
    eventId: string,
    cursor?: EventMessageCursor
  ): Promise<EventMessagePage> {
    assertSupabaseConfigured();

    let query = supabase
      .from('event_messages')
      .select('*, profiles:sender_id(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(EVENT_MESSAGE_PAGE_SIZE + 1);

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as EventMessageRow[];
    const pageRows = rows.slice(0, EVENT_MESSAGE_PAGE_SIZE);
    const oldest = pageRows[pageRows.length - 1];
    return {
      messages: pageRows.map(mapEventMessageRow),
      nextCursor: rows.length > EVENT_MESSAGE_PAGE_SIZE && oldest
        ? { createdAt: oldest.created_at, id: oldest.id }
        : null
    };
  },

  async listEventMessageThreads(): Promise<EventMessageThread[]> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('list_my_event_message_threads');
    if (error) throw error;
    return ((data ?? []) as EventMessageThreadRow[]).map((row) => ({
      eventId: row.event_id,
      title: row.title,
      sport: row.sport,
      coverUrl: row.cover_url,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount: Number(row.unread_count) || 0
    }));
  },

  async markEventChatRead(eventId: string): Promise<void> {
    assertSupabaseConfigured();
    const { error } = await supabase.rpc('mark_event_chat_read', { target_event_id: eventId });
    if (error) throw error;
  },

  async sendEventMessage(
    eventId: string,
    body: string,
    clientMessageId = createUuid()
  ): Promise<EventMessage> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to chat.');

    const { data, error } = await supabase
      .from('event_messages')
      .insert({
        id: clientMessageId,
        event_id: eventId,
        sender_id: authData.user.id,
        body
      })
      .select('*, profiles:sender_id(*)')
      .single();
    if (error) throw error;

    return mapEventMessageRow(data as unknown as EventMessageRow);
  },

  subscribeToEventMessages(
    eventId: string,
    callback: (message: EventMessage) => void,
    onConnectionChange?: (connected: boolean, reconnected: boolean) => void
  ) {
    let hasConnected = false;
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
          callback(mapEventMessageRow(data as unknown as EventMessageRow));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onConnectionChange?.(true, hasConnected);
          hasConnected = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onConnectionChange?.(false, false);
        }
      });

    return {
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      }
    };
  },

  subscribeToEventMessageThreads(
    callback: () => void,
    onConnectionChange?: (connected: boolean, reconnected: boolean) => void
  ) {
    let hasConnected = false;
    const channel = supabase
      .channel('event-message-threads')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages' },
        callback
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onConnectionChange?.(true, hasConnected);
          hasConnected = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onConnectionChange?.(false, false);
        }
      });

    return {
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      }
    };
  }
};
