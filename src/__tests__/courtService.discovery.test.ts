const mockRequestPermission = jest.fn();
const mockGetPosition = jest.fn();
const mockGeocode = jest.fn();
const mockRpc = jest.fn();

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermission(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetPosition(...args),
  geocodeAsync: (...args: unknown[]) => mockGeocode(...args)
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getUser: jest.fn() },
    from: jest.fn()
  }
}));

jest.mock('@/lib/env', () => ({
  env: { isSupabaseConfigured: true }
}));

// eslint-disable-next-line import/first
import { courtService } from '@/services/courtService';

describe('courtService discovery and availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses device coordinates when location permission is granted', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'granted' });
    mockGetPosition.mockResolvedValue({ coords: { latitude: 12.91, longitude: 77.61 } });

    await expect(courtService.getDiscoveryLocation('Bengaluru')).resolves.toEqual({
      status: 'granted',
      coordinates: { latitude: 12.91, longitude: 77.61 },
      source: 'device',
      city: 'Bengaluru'
    });
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it('falls back to city geocoding when permission is denied', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied' });
    mockGeocode.mockResolvedValue([{ latitude: 12.97, longitude: 77.59 }]);

    await expect(courtService.getDiscoveryLocation(' Bengaluru ')).resolves.toEqual({
      status: 'fallback',
      coordinates: { latitude: 12.97, longitude: 77.59 },
      source: 'city',
      city: 'Bengaluru'
    });
  });

  it('keeps discovery usable when permission and geocoding are unavailable', async () => {
    mockRequestPermission.mockRejectedValue(new Error('location unavailable'));
    mockGeocode.mockRejectedValue(new Error('geocoding unavailable'));

    await expect(courtService.getDiscoveryLocation('Mysuru')).resolves.toEqual({
      status: 'unavailable',
      coordinates: null,
      source: null,
      city: 'Mysuru'
    });
  });

  it('passes location and all filters to server discovery and preserves distance order', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'near',
          name: 'Near Court',
          sport: 'Tennis',
          city: 'Bengaluru',
          latitude: 12.9,
          longitude: 77.6,
          distance_km: 1.24,
          surface: 'Clay',
          rating: 4.4,
          hourly_price_cents: 50000,
          currency: 'INR',
          is_open_now: false,
          is_future_bookable: true,
          timezone: 'Asia/Kolkata',
          slot_duration_minutes: 60,
          booking_window_days: 30,
          cancellation_notice_hours: 6,
          booking_requires_approval: true,
          payment_policy: 'external'
        },
        {
          id: 'far',
          name: 'Far Court',
          sport: 'Tennis',
          city: 'Bengaluru',
          latitude: 13,
          longitude: 77.7,
          distance_km: 8.93,
          surface: 'Clay',
          rating: 4.8,
          hourly_price_cents: 60000,
          currency: 'INR',
          is_open_now: true,
          is_future_bookable: true,
          timezone: 'Asia/Kolkata',
          slot_duration_minutes: 60,
          booking_window_days: 30,
          cancellation_notice_hours: 6,
          booking_requires_approval: true,
          payment_policy: 'external'
        }
      ],
      error: null
    });

    const courts = await courtService.listNearbyCourts({
      sport: 'Tennis',
      city: 'Bengaluru',
      surface: 'Clay',
      maxHourlyPrice: 700,
      maxDistanceKm: 10,
      openNowOnly: false,
      futureAvailabilityOnly: true,
      coordinates: { latitude: 12.91, longitude: 77.61 },
      availabilityStart: '2026-07-23',
      availabilityEnd: '2026-07-30'
    });

    expect(courts.map((court) => [court.id, court.distanceKm])).toEqual([
      ['near', 1.2],
      ['far', 8.9]
    ]);
    expect(mockRpc).toHaveBeenCalledWith('discover_courts', expect.objectContaining({
      origin_latitude: 12.91,
      origin_longitude: 77.61,
      filter_sport: 'Tennis',
      filter_surface: 'Clay',
      max_distance_km: 10,
      max_price_cents: 70000,
      require_future_availability: true
    }));
  });

  it('maps only slots returned by the availability RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        starts_at: '2026-07-25T04:30:00.000Z',
        ends_at: '2026-07-25T05:30:00.000Z',
        slot_duration_minutes: 60,
        price_cents: 90000,
        currency: 'INR'
      }],
      error: null
    });

    await expect(
      courtService.listAvailability('court-1', '2026-07-25', '2026-07-26')
    ).resolves.toEqual([{
      startsAt: '2026-07-25T04:30:00.000Z',
      endsAt: '2026-07-25T05:30:00.000Z',
      slotDurationMinutes: 60,
      price: 900,
      currency: 'INR'
    }]);
  });

  it('uses lifecycle RPCs for atomic booking and cancellation', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [{ booking_id: 'booking-1', booking_status: 'pending' }],
        error: null
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      courtService.bookCourt(
        'court-1',
        '2026-07-25T04:30:00.000Z',
        '2026-07-25T05:30:00.000Z'
      )
    ).resolves.toEqual({ bookingId: 'booking-1', status: 'pending' });
    await courtService.cancelBooking('booking-1', 'Changed plans');

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'book_court_slot', {
      target_court_id: 'court-1',
      target_starts_at: '2026-07-25T04:30:00.000Z',
      target_ends_at: '2026-07-25T05:30:00.000Z'
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'cancel_court_booking', {
      target_booking_id: 'booking-1',
      cancellation_reason: 'Changed plans'
    });
  });
});
