import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { eventService, type CreateEventInput } from '@/services/eventService';
import type { SportEvent } from '@/types/domain';

export const eventKeys = {
  all: ['events'] as const,
  detail: (id: string) => ['events', id] as const
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    }
  });
};
