import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { Court, Sport } from '@/types/domain';

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

    const { data: overlapping, error: overlapError } = await supabase
      .from('court_bookings')
      .select('id')
      .eq('court_id', courtId)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt)
      .limit(1);
    if (overlapError) throw overlapError;
    if (overlapping?.length) {
      throw new Error('That time slot is already requested. Choose another time.');
    }

    const { error } = await supabase.from('court_bookings').insert({
      court_id: courtId,
      user_id: authData.user.id,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'pending'
    });
    if (error) throw error;
  }
};
