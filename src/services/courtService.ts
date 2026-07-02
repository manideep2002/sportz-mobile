import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { Court, CourtBooking, Sport } from '@/types/domain';

export interface CourtFilters {
  sport?: Sport;
  city?: string;
  surface?: string;
  maxHourlyPrice?: number;
  availableOnly?: boolean;
}

const mapCourtRow = (court: Record<string, any>): Court => ({
  id: court.id,
  name: court.name,
  sport: court.sport as Sport,
  city: court.city,
  latitude: court.latitude,
  longitude: court.longitude,
  distanceKm: 0,
  surface: court.surface ?? 'Court',
  rating: court.rating ?? 0,
  hourlyPrice: (court.hourly_price_cents ?? 0) / 100,
  currency: court.currency as Court['currency'],
  availableNow: court.availability_status === 'available',
  availabilityLabel: court.availability_status === 'available' ? 'Available' : court.availability_status
});

const mapCourtBookingRow = (row: Record<string, any>): CourtBooking => ({
  id: row.id,
  court: mapCourtRow(row.courts ?? { id: row.court_id, name: 'Court', sport: 'Basketball', city: '', latitude: 0, longitude: 0 }),
  user: mapProfileRow(row.profiles ?? { id: row.user_id }),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  status: row.status,
  createdAt: row.created_at
});

export const courtService = {
  async getCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return location.coords;
  },

  async listNearbyCourts(filters: CourtFilters = {}): Promise<Court[]> {
    assertSupabaseConfigured();

    let request = supabase.from('courts').select('*').limit(30);
    if (filters.sport) request = request.eq('sport', filters.sport);
    if (filters.city?.trim()) request = request.ilike('city', `%${filters.city.trim()}%`);
    if (filters.surface) request = request.eq('surface', filters.surface);
    if (filters.maxHourlyPrice !== undefined) request = request.lte('hourly_price_cents', Math.round(filters.maxHourlyPrice * 100));
    if (filters.availableOnly) request = request.eq('availability_status', 'available');
    const { data, error } = await request;
    if (error) throw error;

    return (data ?? []).map(mapCourtRow);
  },

  async getCourt(courtId: string): Promise<Court> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.from('courts').select('*').eq('id', courtId).single();
    if (error) throw error;
    return mapCourtRow(data);
  },

  async bookCourt(courtId: string, startsAt: string, endsAt: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to book a court.');

    const { error } = await supabase.rpc('book_court_slot', {
      target_court_id: courtId,
      target_starts_at: startsAt,
      target_ends_at: endsAt
    });
    if (error) throw error;
  },

  async listCourtBookings(courtId?: string): Promise<CourtBooking[]> {
    assertSupabaseConfigured();

    let request = supabase
      .from('court_bookings')
      .select('*, courts:court_id(*), profiles:user_id(*)')
      .order('starts_at', { ascending: true })
      .limit(80);
    if (courtId) request = request.eq('court_id', courtId);

    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []).map((row) => mapCourtBookingRow(row as Record<string, any>));
  },

  async updateCourtBookingStatus(bookingId: string, status: CourtBooking['status']): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('update_court_booking_status', {
      target_booking_id: bookingId,
      target_status: status
    });
    if (error) throw error;
  }
};
