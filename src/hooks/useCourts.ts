import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  courtService,
  type CourtBookingCursor,
  type CourtCoordinates,
  type CourtFilters
} from '@/services/courtService';
import { overpassService } from '@/services/overpassService';
import { useAuthStore } from '@/store/authStore';
import type { Sport } from '@/types/domain';

const courtKeys = {
  all: ['courts'] as const,
  location: (city: string) => ['court-location', city] as const,
  list: (filters: CourtFilters) => ['courts', 'discovery', filters] as const,
  detail: (courtId: string, coordinates?: CourtCoordinates | null) =>
    ['courts', 'detail', courtId, coordinates ?? null] as const,
  availability: (courtId: string, start: string, end: string) =>
    ['courts', 'availability', courtId, start, end] as const,
  bookings: ['court-bookings'] as const,
  myBookings: ['court-bookings', 'mine'] as const,
  adminBookings: (courtId?: string) => ['court-bookings', 'admin', courtId ?? 'all'] as const,
  booking: (bookingId: string) => ['court-bookings', 'detail', bookingId] as const
};

export const useCourtDiscoveryLocation = (fallbackCity: string) =>
  useQuery({
    queryKey: courtKeys.location(fallbackCity.trim().toLowerCase()),
    queryFn: () => courtService.getDiscoveryLocation(fallbackCity),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false
  });

export const useCourts = (filters: CourtFilters = {}) =>
  useQuery({
    queryKey: courtKeys.list(filters),
    queryFn: () => courtService.listNearbyCourts(filters)
  });

export const useCourt = (courtId: string, coordinates?: CourtCoordinates | null) =>
  useQuery({
    queryKey: courtKeys.detail(courtId, coordinates),
    queryFn: () => courtService.getCourt(courtId, coordinates),
    enabled: Boolean(courtId)
  });

export const useCourtAvailability = (courtId: string, rangeStart: string, rangeEnd: string) =>
  useQuery({
    queryKey: courtKeys.availability(courtId, rangeStart, rangeEnd),
    queryFn: () => courtService.listAvailability(courtId, rangeStart, rangeEnd),
    enabled: Boolean(courtId && rangeStart && rangeEnd)
  });

export const useBookCourt = (courtId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ startsAt, endsAt }: { startsAt: string; endsAt: string }) =>
      courtService.bookCourt(courtId, startsAt, endsAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courtKeys.all });
      void queryClient.invalidateQueries({ queryKey: courtKeys.bookings });
    }
  });
};

export const useMyCourtBookings = (enabled = true) =>
  useInfiniteQuery({
    queryKey: courtKeys.myBookings,
    queryFn: ({ pageParam }) => courtService.listMyBookings(pageParam),
    initialPageParam: undefined as CourtBookingCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled
  });

export const useAdminCourtBookings = (courtId?: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: courtKeys.adminBookings(courtId),
    queryFn: ({ pageParam }) => courtService.listAdminCourtBookings(courtId, pageParam),
    initialPageParam: undefined as CourtBookingCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled
  });

/**
 * Fetches a single booking. Reads `profile.isAdmin` from the local auth store
 * so that `booking.capabilities` reflects full admin authority when applicable.
 */
export const useCourtBooking = (bookingId: string) => {
  const isAdmin = useAuthStore((state) => Boolean(state.profile?.isAdmin));
  return useQuery({
    queryKey: courtKeys.booking(bookingId),
    queryFn: () => courtService.getBooking(bookingId, isAdmin),
    enabled: Boolean(bookingId)
  });
};

export const useCancelCourtBooking = (bookingId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      courtService.cancelBooking(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courtKeys.bookings });
      if (bookingId) void queryClient.invalidateQueries({ queryKey: courtKeys.booking(bookingId) });
      void queryClient.invalidateQueries({ queryKey: courtKeys.all });
    },
    onError: () => {
      // Re-fetch so the UI reflects the true server state after a failed cancel.
      if (bookingId) void queryClient.invalidateQueries({ queryKey: courtKeys.booking(bookingId) });
    }
  });
};

export const useUpdateCourtBookingStatus = (courtId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookingId,
      status,
      reason
    }: {
      bookingId: string;
      status: 'confirmed' | 'cancelled';
      reason?: string;
    }) => courtService.updateCourtBookingStatus(bookingId, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courtKeys.adminBookings(courtId) });
      void queryClient.invalidateQueries({ queryKey: courtKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: courtKeys.all });
    },
    onError: (_err, { bookingId }) => {
      // Re-fetch individual booking on conflict or auth failure so list is coherent.
      void queryClient.invalidateQueries({ queryKey: courtKeys.booking(bookingId) });
    }
  });
};

/**
 * Fetches nearby sports venues from the OpenStreetMap Overpass API.
 *
 * Only runs when coordinates are available (i.e. location permission granted
 * or a city was resolved to coordinates).  Results are cached for 10 minutes
 * to avoid hammering the free Overpass endpoint.
 */
export const useOverpassVenues = (
  coordinates: CourtCoordinates | null,
  sport: Sport | 'All' = 'All',
  radiusKm = 5
) =>
  useQuery({
    queryKey: ['overpass-venues', coordinates, sport, radiusKm] as const,
    queryFn: () => overpassService.fetchNearbyVenues(coordinates!, sport, radiusKm),
    enabled: coordinates !== null,
    staleTime: 10 * 60 * 1000, // 10 minutes – respect public API rate limits
    retry: 1                   // one extra attempt after the mirror sweep
  });
