import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import { profileService } from '@/services/profileService';
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

const entryFeeLabel = (currency: string | null | undefined, cents: number | null | undefined) =>
  (cents ?? 0) > 0 ? `${currency ?? 'INR'} ${(cents ?? 0) / 100}` : 'Free';

const mapEventRow = (row: any, playerCount = 0, attendees: SportEvent['attendees'] = []): SportEvent => ({
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
      .gte('starts_at', new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
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
      attendeeRows?.forEach((attendee) => {
        counts.set(attendee.event_id, (counts.get(attendee.event_id) ?? 0) + 1);
      });
    }

    return (data ?? []).map((row: any) => mapEventRow(row, counts.get(row.id) ?? 0));
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

    const attendees = (attendeeData ?? []).map((row: any) => mapProfileRow(row.profiles ?? { id: row.user_id }));

    return mapEventRow(data, attendees.length, attendees);
  },

  async createEvent(input: CreateEventInput): Promise<SportEvent> {
    assertSupabaseConfigured();

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
      .select('*, profiles:organizer_id(*)')
      .single();

    if (error) throw error;

    const organizer = await profileService.getProfile(authData.user.id);
    return {
      ...mapEventRow(data, 1, [organizer]),
      organizer,
      attendees: [organizer]
    };
  },

  async joinEvent(eventId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to join events.');

    const { error } = await supabase.from('event_attendees').upsert({
      event_id: eventId,
      user_id: authData.user.id,
      status: 'going'
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
  }
};
