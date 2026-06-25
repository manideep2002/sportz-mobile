import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { Court, Sport } from '@/types/domain';

export const courtService = {
  async getCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return location.coords;
  },

  async listNearbyCourts(sport?: Sport): Promise<Court[]> {
    assertSupabaseConfigured();

    let request = supabase.from('courts').select('*').limit(30);
    if (sport) request = request.eq('sport', sport);
    const { data, error } = await request;
    if (error) throw error;

    return (data ?? []).map((court) => ({
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
    }));
  }
};
