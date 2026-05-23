import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { currentUser } from '@/data/mockData';
import { env } from '@/lib/env';
import { messageService } from '@/services/messageService';
import type { Conversation, Message } from '@/types/domain';
import { formatConversationPreview } from '@/utils/messages';

const sortConversations = (items: Conversation[]) =>
  [...items].sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());

export const updateConversationPreviewInCache = (
  queryClient: QueryClient,
  conversationId: string,
  message: Pick<Message, 'body' | 'createdAt' | 'senderId'>
) => {
  const lastMessage = formatConversationPreview(message.body, message.senderId, currentUser.id);

  queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (old = []) =>
    sortConversations(
      old.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, lastMessage, lastMessageAt: message.createdAt } : conversation
      )
    )
  );
};

const clearConversationUnread = (queryClient: QueryClient, conversationId: string) => {
  queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (old = []) =>
    old.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
    )
  );
};

export const messageKeys = {
  conversations: ['conversations'] as const,
  conversation: (conversationId: string) => ['conversation', conversationId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const
};

export const useConversation = (conversationId: string) =>
  useQuery({
    queryKey: messageKeys.conversation(conversationId),
    queryFn: () => messageService.getConversation(conversationId)
  });

export const useConversations = () =>
  useQuery({
    queryKey: messageKeys.conversations,
    queryFn: messageService.listConversations
  });

export const useConversationMessages = (conversationId: string) =>
  useQuery({
    queryKey: messageKeys.messages(conversationId),
    queryFn: () => messageService.listMessages(conversationId)
  });

export const useMarkConversationRead = (conversationId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    clearConversationUnread(queryClient, conversationId);

    void (async () => {
      await messageService.markConversationRead(conversationId);

      if (!env.isSupabaseConfigured) {
        queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
          old.map((message) =>
            message.senderId === currentUser.id
              ? message
              : {
                  ...message,
                  readBy: message.readBy.includes(currentUser.id) ? message.readBy : [...message.readBy, currentUser.id]
                }
          )
        );
        clearConversationUnread(queryClient, conversationId);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: messageKeys.messages(conversationId) }),
        queryClient.invalidateQueries({ queryKey: messageKeys.conversations })
      ]);
    })();
  }, [conversationId, queryClient]);
};

export const useSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => messageService.sendMessage(conversationId, body),
    onMutate: async (body) => {
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        body,
        createdAt: new Date().toISOString(),
        readBy: [currentUser.id],
        pending: true
      };
      await queryClient.cancelQueries({ queryKey: messageKeys.messages(conversationId) });
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) => [...old, optimistic]);
      updateConversationPreviewInCache(queryClient, conversationId, optimistic);
      return { optimisticId: optimistic.id };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
        old.map((item) => (item.id === context?.optimisticId ? message : item))
      );
      updateConversationPreviewInCache(queryClient, conversationId, message);
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
        old.filter((item) => item.id !== context?.optimisticId)
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations });
    }
  });
};
