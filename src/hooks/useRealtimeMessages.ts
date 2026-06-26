import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { messageKeys, patchConversationPreviewInCacheForRealtime } from './useMessages';
import { realtimeService } from '@/services/realtimeService';
import { useAuthStore } from '@/store/authStore';
import type { Message } from '@/types/domain';

export const useRealtimeMessages = (conversationId: string) => {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');

  useEffect(() => {
    const channel = realtimeService.subscribeToConversation(conversationId, (message) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) => {
        if (old.some((item) => item.id === message.id)) return old;
        return [...old, message];
      });
      patchConversationPreviewInCacheForRealtime(queryClient, conversationId, message, currentUserId);
    });

    return () => realtimeService.unsubscribe(channel);
  }, [conversationId, queryClient, currentUserId]);
};

