import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  courtService,
  type CourtCoordinates,
  type CourtFilters
} from '@/services/courtService';

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
  useQuery({
    queryKey: courtKeys.myBookings,
    queryFn: () => courtService.listMyBookings(),
    enabled
  });

export const useAdminCourtBookings = (courtId?: string, enabled = true) =>
  useQuery({
    queryKey: courtKeys.adminBookings(courtId),
    queryFn: () => courtService.listAdminCourtBookings(courtId),
    enabled
  });

export const useCourtBooking = (bookingId: string) =>
  useQuery({
    queryKey: courtKeys.booking(bookingId),
    queryFn: () => courtService.getBooking(bookingId),
    enabled: Boolean(bookingId)
  });

export const useCancelCourtBooking = (bookingId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => courtService.cancelBooking(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courtKeys.bookings });
      if (bookingId) void queryClient.invalidateQueries({ queryKey: courtKeys.booking(bookingId) });
      void queryClient.invalidateQueries({ queryKey: courtKeys.all });
    }
  });
};

export const useUpdateCourtBookingStatus = (courtId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookingId,
      status
    }: {
      bookingId: string;
      status: 'confirmed' | 'cancelled';
    }) => courtService.updateCourtBookingStatus(bookingId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courtKeys.adminBookings(courtId) });
      void queryClient.invalidateQueries({ queryKey: courtKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: courtKeys.all });
    }
  });
};
