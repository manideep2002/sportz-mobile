import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { eventService, type CreateEventInput, type UpdateEventInput } from '@/services/eventService';
import type { EventParticipationStatus, SportEvent } from '@/types/domain';

export const eventKeys = {
  all: ['events'] as const,
  detail: (id: string) => ['events', id] as const,
  waitlist: (id: string) => ['events', id, 'waitlist'] as const,
  participation: (id: string) => ['events', id, 'participation'] as const,
  participationBatch: (ids: string[]) => ['events', 'participation', 'batch', ids] as const
};

const refreshEventQueries = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: eventKeys.all });

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
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useLeaveEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.leaveEvent(eventId),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useLeaveEventWaitlist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.leaveEventWaitlist(eventId),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: UpdateEventInput }) =>
      eventService.updateEvent(eventId, updates),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useRemoveEventAttendee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      eventService.removeAttendee(eventId, userId),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useRemoveEventWaitlistUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      eventService.removeWaitlistUser(eventId, userId),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const usePromoteEventWaitlistUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      eventService.promoteWaitlistUser(eventId, userId),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useCancelEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.cancelEvent(eventId),
    onSuccess: () => refreshEventQueries(queryClient)
  });
};

export const useEventParticipation = (eventId: string) =>
  useQuery({
    queryKey: eventKeys.participation(eventId),
    queryFn: () => eventService.checkUserParticipation(eventId),
    staleTime: 1000 * 30
  });

export const useEventParticipationBatch = (eventIds: string[]) => {
  const normalizedEventIds = Array.from(new Set(eventIds)).sort();
  return useQuery<Record<string, EventParticipationStatus>>({
    queryKey: eventKeys.participationBatch(normalizedEventIds),
    queryFn: () => eventService.checkUserParticipationBatch(normalizedEventIds),
    enabled: normalizedEventIds.length > 0,
    staleTime: 1000 * 30
  });
};

export const useEventWaitlist = (eventId: string) =>
  useQuery({
    queryKey: eventKeys.waitlist(eventId),
    queryFn: () => eventService.listWaitlist(eventId),
    enabled: Boolean(eventId)
  });
