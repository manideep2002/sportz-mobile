import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { messageKeys } from './useMessages';
import { realtimeService } from '@/services/realtimeService';
import type { Message } from '@/types/domain';

export const useRealtimeMessages = (conversationId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = realtimeService.subscribeToConversation(conversationId, (message) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) => {
        if (old.some((item) => item.id === message.id)) return old;
        return [...old, message];
      });
    });

    return () => realtimeService.unsubscribe(channel);
  }, [conversationId, queryClient]);
};
