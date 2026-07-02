import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { messageService } from '@/services/messageService';
import { useAuthStore } from '@/store/authStore';
import { useMessagingStore } from '@/store/messagingStore';
import type { Conversation, Message } from '@/types/domain';
import { applyConversationPreview, buildConversationPreview, mergeConfirmedMessage } from '@/utils/messages';

export const messageKeys = {
  conversations: ['conversations'] as const,
  conversation: (conversationId: string) => ['conversation', conversationId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const
};

const patchConversationPreviewInCache = (
  queryClient: QueryClient,
  conversationId: string,
  message: Pick<Message, 'body' | 'createdAt' | 'senderId'>,
  currentUserId: string
) => {
  const preview = buildConversationPreview(message, currentUserId);
  queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (old = []) =>
    applyConversationPreview(old, conversationId, preview)
  );
};

const clearConversationUnread = (queryClient: QueryClient, conversationId: string) => {
  queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (old = []) =>
    old.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
    )
  );
};

export const useConversation = (conversationId: string) =>
  useQuery({
    queryKey: messageKeys.conversation(conversationId),
    queryFn: () => messageService.getConversation(conversationId)
  });

export const useConversations = () => {
  const readConversationIds = useMessagingStore((state) => state.readConversationIds);
  return useQuery({
    queryKey: messageKeys.conversations,
    queryFn: () => messageService.listConversations(readConversationIds),
    refetchInterval: 5000,
    refetchOnMount: 'always',
    staleTime: 0
  });
};

export const useConversationMessages = (conversationId: string) =>
  useQuery({
    queryKey: messageKeys.messages(conversationId),
    queryFn: () => messageService.listMessages(conversationId)
  });

export const useMarkConversationRead = (conversationId: string) => {
  const queryClient = useQueryClient();
  const markReadLocally = useMessagingStore((state) => state.markConversationReadLocally);

  useEffect(() => {
    // Immediately zero the badge in the store and cache — no DB round-trip needed for UX
    markReadLocally(conversationId);
    clearConversationUnread(queryClient, conversationId);

    void (async () => {
      await messageService.markConversationRead(conversationId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: messageKeys.messages(conversationId) }),
        queryClient.invalidateQueries({ queryKey: messageKeys.conversations })
      ]);
    })();
  }, [conversationId, queryClient, markReadLocally]);
};

export const useSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: (body: string) => messageService.sendMessage(conversationId, body),
    onMutate: async (body) => {
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        senderId: currentUserId,
        body,
        createdAt: new Date().toISOString(),
        readBy: [currentUserId],
        pending: true
      };
      await queryClient.cancelQueries({ queryKey: messageKeys.messages(conversationId) });
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) => [...old, optimistic]);
      patchConversationPreviewInCache(queryClient, conversationId, optimistic, currentUserId);
      return { optimisticId: optimistic.id };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
        mergeConfirmedMessage(old, context?.optimisticId, message)
      );
      patchConversationPreviewInCache(queryClient, conversationId, message, currentUserId);
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
        old.filter((item) => item.id !== context?.optimisticId)
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations });
    }
  });
};

export const patchConversationPreviewInCacheForRealtime = (
  queryClient: QueryClient,
  conversationId: string,
  message: Pick<Message, 'body' | 'createdAt' | 'senderId'>,
  currentUserId: string
) => patchConversationPreviewInCache(queryClient, conversationId, message, currentUserId);
