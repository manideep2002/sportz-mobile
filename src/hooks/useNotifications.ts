import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/services/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const
};

export const useNotifications = () =>
  useQuery({
    queryKey: notificationKeys.all,
    queryFn: notificationService.listNotifications
  });

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    }
  });
};
