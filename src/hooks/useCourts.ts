import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { courtService, type CourtFilters } from '@/services/courtService';

export const useCourts = (filters: CourtFilters = {}) =>
  useQuery({
    queryKey: ['courts', filters],
    queryFn: () => courtService.listNearbyCourts(filters)
  });

export const useCourt = (courtId: string) =>
  useQuery({
    queryKey: ['courts', courtId],
    queryFn: () => courtService.getCourt(courtId),
    enabled: Boolean(courtId)
  });

export const useCourtBookings = (courtId?: string) =>
  useQuery({
    queryKey: ['court-bookings', courtId ?? 'all'],
    queryFn: () => courtService.listCourtBookings(courtId)
  });

export const useUpdateCourtBookingStatus = (courtId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: 'pending' | 'confirmed' | 'cancelled' }) =>
      courtService.updateCourtBookingStatus(bookingId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['court-bookings', courtId ?? 'all'] });
    }
  });
};
