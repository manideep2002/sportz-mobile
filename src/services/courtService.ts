import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { Court, CourtAvailabilitySlot, CourtBooking, Sport } from '@/types/domain';

export interface CourtCoordinates {
  latitude: number;
  longitude: number;
}

export type CourtLocationResult =
  | { status: 'granted'; coordinates: CourtCoordinates; source: 'device'; city: string | null }
  | { status: 'fallback'; coordinates: CourtCoordinates; source: 'city'; city: string }
  | { status: 'denied' | 'unavailable'; coordinates: null; source: null; city: string | null };

export interface CourtFilters {
  sport?: Sport;
  city?: string;
  surface?: string;
  maxHourlyPrice?: number;
  maxDistanceKm?: number;
  openNowOnly?: boolean;
  futureAvailabilityOnly?: boolean;
  coordinates?: CourtCoordinates | null;
  availabilityStart?: string;
  availabilityEnd?: string;
}

interface CourtRow {
  id?: unknown;
  name?: unknown;
  sport?: unknown;
  city?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  distance_km?: unknown;
  surface?: unknown;
  rating?: unknown;
  hourly_price_cents?: unknown;
  currency?: unknown;
  is_open_now?: unknown;
  is_future_bookable?: unknown;
  booking_enabled?: unknown;
  timezone?: unknown;
  slot_duration_minutes?: unknown;
  booking_window_days?: unknown;
  cancellation_notice_hours?: unknown;
  booking_requires_approval?: unknown;
  payment_policy?: unknown;
}

interface BookingRow {
  id?: unknown;
  court_id?: unknown;
  user_id?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  cancelled_at?: unknown;
  cancellation_reason?: unknown;
  price_cents?: unknown;
  currency?: unknown;
  courts?: CourtRow | null;
  profiles?: Record<string, unknown> | null;
}

const textValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapCourtRow = (court: CourtRow): Court => {
  const openNow = Boolean(court.is_open_now);
  const futureBookable = court.is_future_bookable === undefined
    ? Boolean(court.booking_enabled)
    : Boolean(court.is_future_bookable);

  return {
    id: textValue(court.id),
    name: textValue(court.name, 'Court'),
    sport: textValue(court.sport, 'Basketball') as Sport,
    city: textValue(court.city),
    address: typeof court.address === 'string' ? court.address : null,
    latitude: numberValue(court.latitude),
    longitude: numberValue(court.longitude),
    distanceKm: court.distance_km === null || court.distance_km === undefined
      ? null
      : Math.round(numberValue(court.distance_km) * 10) / 10,
    surface: textValue(court.surface, 'Court'),
    rating: numberValue(court.rating),
    hourlyPrice: numberValue(court.hourly_price_cents) / 100,
    currency: textValue(court.currency, 'INR') as Court['currency'],
    openNow,
    futureBookable,
    availabilityLabel: openNow ? 'Open now' : futureBookable ? 'Bookable' : 'Unavailable',
    timezone: textValue(court.timezone, 'Asia/Kolkata'),
    slotDurationMinutes: numberValue(court.slot_duration_minutes, 60),
    bookingWindowDays: numberValue(court.booking_window_days, 30),
    cancellationNoticeHours: numberValue(court.cancellation_notice_hours, 6),
    bookingRequiresApproval: court.booking_requires_approval !== false,
    paymentPolicy: court.payment_policy === 'not_required' ? 'not_required' : 'external'
  };
};

const fallbackCourtRow = (row: BookingRow): CourtRow => ({
  id: row.court_id,
  name: 'Court',
  sport: 'Basketball',
  city: '',
  latitude: 0,
  longitude: 0,
  booking_enabled: false
});

const mapCourtBookingRow = (row: BookingRow): CourtBooking => {
  const court = mapCourtRow(row.courts ?? fallbackCourtRow(row));
  const startsAt = textValue(row.starts_at);
  const status = textValue(row.status, 'pending') as CourtBooking['status'];
  const cancellationDeadline = new Date(
    new Date(startsAt).getTime() - court.cancellationNoticeHours * 60 * 60 * 1000
  ).toISOString();

  return {
    id: textValue(row.id),
    court,
    user: mapProfileRow(row.profiles ?? { id: textValue(row.user_id) }),
    startsAt,
    endsAt: textValue(row.ends_at),
    status,
    price: numberValue(row.price_cents, court.hourlyPrice * 100) / 100,
    currency: textValue(row.currency, court.currency) as Court['currency'],
    createdAt: textValue(row.created_at),
    updatedAt: textValue(row.updated_at, textValue(row.created_at)),
    cancelledAt: typeof row.cancelled_at === 'string' ? row.cancelled_at : null,
    cancellationReason: typeof row.cancellation_reason === 'string' ? row.cancellation_reason : null,
    canCancel: (status === 'pending' || status === 'confirmed') && Date.now() <= new Date(cancellationDeadline).getTime(),
    cancellationDeadline
  };
};

const geocodeCity = async (city: string): Promise<CourtCoordinates | null> => {
  const normalizedCity = city.trim();
  if (!normalizedCity) return null;
  const [place] = await Location.geocodeAsync(normalizedCity);
  return place ? { latitude: place.latitude, longitude: place.longitude } : null;
};

export const courtService = {
  async getDiscoveryLocation(fallbackCity = ''): Promise<CourtLocationResult> {
    const normalizedCity = fallbackCity.trim();
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return {
          status: 'granted',
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          },
          source: 'device',
          city: normalizedCity || null
        };
      }

      const fallbackCoordinates = await geocodeCity(normalizedCity);
      return fallbackCoordinates
        ? { status: 'fallback', coordinates: fallbackCoordinates, source: 'city', city: normalizedCity }
        : { status: 'denied', coordinates: null, source: null, city: normalizedCity || null };
    } catch {
      try {
        const fallbackCoordinates = await geocodeCity(normalizedCity);
        if (fallbackCoordinates) {
          return { status: 'fallback', coordinates: fallbackCoordinates, source: 'city', city: normalizedCity };
        }
      } catch {
        // Discovery remains usable with a city-only server filter.
      }
      return { status: 'unavailable', coordinates: null, source: null, city: normalizedCity || null };
    }
  },

  async geocodeDiscoveryCity(city: string): Promise<CourtCoordinates | null> {
    try {
      return await geocodeCity(city);
    } catch {
      return null;
    }
  },

  async listNearbyCourts(filters: CourtFilters = {}): Promise<Court[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('discover_courts', {
      target_court_id: null,
      origin_latitude: filters.coordinates?.latitude ?? null,
      origin_longitude: filters.coordinates?.longitude ?? null,
      filter_city: filters.city?.trim() || null,
      filter_sport: filters.sport ?? null,
      filter_surface: filters.surface?.trim() || null,
      max_distance_km: filters.coordinates ? filters.maxDistanceKm ?? null : null,
      max_price_cents: filters.maxHourlyPrice === undefined ? null : Math.round(filters.maxHourlyPrice * 100),
      require_open_now: filters.openNowOnly ?? false,
      require_future_availability: filters.futureAvailabilityOnly ?? false,
      availability_start: filters.availabilityStart ?? new Date().toISOString().slice(0, 10),
      availability_end: filters.availabilityEnd ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      result_limit: 50
    });
    if (error) throw error;

    return ((data ?? []) as CourtRow[]).map(mapCourtRow);
  },

  async getCourt(courtId: string, coordinates?: CourtCoordinates | null): Promise<Court> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('discover_courts', {
      target_court_id: courtId,
      origin_latitude: coordinates?.latitude ?? null,
      origin_longitude: coordinates?.longitude ?? null,
      filter_city: null,
      filter_sport: null,
      filter_surface: null,
      max_distance_km: null,
      max_price_cents: null,
      require_open_now: false,
      require_future_availability: false,
      availability_start: new Date().toISOString().slice(0, 10),
      availability_end: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      result_limit: 1
    });
    if (error) throw error;
    const row = ((data ?? []) as CourtRow[])[0];
    if (!row) throw new Error('Court not found.');
    return mapCourtRow(row);
  },

  async listAvailability(courtId: string, rangeStart: string, rangeEnd: string): Promise<CourtAvailabilitySlot[]> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('get_court_availability', {
      target_court_id: courtId,
      range_start: rangeStart,
      range_end: rangeEnd
    });
    if (error) throw error;

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      startsAt: textValue(row.starts_at),
      endsAt: textValue(row.ends_at),
      slotDurationMinutes: numberValue(row.slot_duration_minutes),
      price: numberValue(row.price_cents) / 100,
      currency: textValue(row.currency, 'INR') as Court['currency']
    }));
  },

  async bookCourt(
    courtId: string,
    startsAt: string,
    endsAt: string
  ): Promise<{ bookingId: string; status: CourtBooking['status'] }> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('book_court_slot', {
      target_court_id: courtId,
      target_starts_at: startsAt,
      target_ends_at: endsAt
    });
    if (error) throw error;
    const row = ((data ?? []) as Record<string, unknown>[])[0];
    if (!row) throw new Error('Booking could not be created.');
    return {
      bookingId: textValue(row.booking_id),
      status: textValue(row.booking_status, 'pending') as CourtBooking['status']
    };
  },

  async listMyBookings(): Promise<CourtBooking[]> {
    assertSupabaseConfigured();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to view bookings.');

    const { data, error } = await supabase
      .from('court_bookings')
      .select('*, courts:court_id(*), profiles:user_id(*)')
      .eq('user_id', authData.user.id)
      .order('starts_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    return ((data ?? []) as BookingRow[]).map(mapCourtBookingRow);
  },

  async listAdminCourtBookings(courtId?: string): Promise<CourtBooking[]> {
    assertSupabaseConfigured();
    let request = supabase
      .from('court_bookings')
      .select('*, courts:court_id(*), profiles:user_id(*)')
      .order('starts_at', { ascending: true })
      .limit(100);
    if (courtId) request = request.eq('court_id', courtId);
    const { data, error } = await request;
    if (error) throw error;
    return ((data ?? []) as BookingRow[]).map(mapCourtBookingRow);
  },

  async getBooking(bookingId: string): Promise<CourtBooking> {
    assertSupabaseConfigured();
    const { data, error } = await supabase
      .from('court_bookings')
      .select('*, courts:court_id(*), profiles:user_id(*)')
      .eq('id', bookingId)
      .single();
    if (error) throw error;
    return mapCourtBookingRow(data as BookingRow);
  },

  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    assertSupabaseConfigured();
    const { error } = await supabase.rpc('cancel_court_booking', {
      target_booking_id: bookingId,
      cancellation_reason: reason?.trim() || null
    });
    if (error) throw error;
  },

  async updateCourtBookingStatus(
    bookingId: string,
    status: Extract<CourtBooking['status'], 'confirmed' | 'cancelled'>
  ): Promise<void> {
    assertSupabaseConfigured();
    const { error } = await supabase.rpc('update_court_booking_status', {
      target_booking_id: bookingId,
      target_status: status
    });
    if (error) throw error;
  }
};
