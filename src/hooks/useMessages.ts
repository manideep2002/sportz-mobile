import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { messageService } from '@/services/messageService';
import type { Message } from '@/types/domain';

export const messageKeys = {
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const
};

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

export const useSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => messageService.sendMessage(conversationId, body),
    onMutate: async (body) => {
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        senderId: 'user-marcus',
        body,
        createdAt: new Date().toISOString(),
        readBy: ['user-marcus'],
        pending: true
      };
      await queryClient.cancelQueries({ queryKey: messageKeys.messages(conversationId) });
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) => [...old, optimistic]);
      return { optimisticId: optimistic.id };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
        old.map((item) => (item.id === context?.optimisticId ? message : item))
      );
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData<Message[]>(messageKeys.messages(conversationId), (old = []) =>
        old.filter((item) => item.id !== context?.optimisticId)
      );
    }
  });
};
