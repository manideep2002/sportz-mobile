import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { eventService, type CreateEventInput, type UpdateEventInput } from '@/services/eventService';
import type { SportEvent } from '@/types/domain';

export const eventKeys = {
  all: ['events'] as const,
  detail: (id: string) => ['events', id] as const,
  waitlist: (id: string) => ['events', id, 'waitlist'] as const
};

export const useEvents = () =>
  useQuery({
    queryKey: eventKeys.all,
    queryFn: eventService.listEvents
  });

export const useEvent = (eventId: string) =>
  useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => eventService.getEvent(eventId)
  });

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => eventService.createEvent(input),
    onSuccess: (event) => {
      queryClient.setQueryData<SportEvent[]>(eventKeys.all, (old = []) => [event, ...old]);
    }
  });
};

export const useJoinEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.joinEvent(eventId),
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    }
  });
};

export const useLeaveEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.leaveEvent(eventId),
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    }
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: UpdateEventInput }) =>
      eventService.updateEvent(eventId, updates),
    onSuccess: (_data, { eventId }) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    }
  });
};

export const useRemoveEventAttendee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      eventService.removeAttendee(eventId, userId),
    onSuccess: (_data, { eventId }) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventKeys.waitlist(eventId) });
    }
  });
};

export const useCancelEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.cancelEvent(eventId),
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    }
  });
};

export const useCheckAttendance = (eventId: string) =>
  useQuery({
    queryKey: [...eventKeys.detail(eventId), 'attendance'] as const,
    queryFn: () => eventService.checkUserAttendance(eventId),
    staleTime: 1000 * 30
  });

export const useEventWaitlist = (eventId: string) =>
  useQuery({
    queryKey: eventKeys.waitlist(eventId),
    queryFn: () => eventService.listWaitlist(eventId),
    enabled: Boolean(eventId)
  });
