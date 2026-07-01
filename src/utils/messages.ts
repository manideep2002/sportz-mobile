import type { Conversation, ID, Message } from '@/types/domain';
import { sortConversations } from '@/utils/conversation';

export const formatConversationPreview = (body: string, senderId: ID, currentUserId: ID) =>
  senderId === currentUserId ? `You: ${body}` : body;

export const buildConversationPreview = (message: Pick<Message, 'body' | 'createdAt' | 'senderId'>, currentUserId: ID) => ({
  lastMessage: formatConversationPreview(message.body, message.senderId, currentUserId),
  lastMessageAt: message.createdAt
});

export const applyConversationPreview = (
  conversations: Conversation[],
  conversationId: string,
  preview: { lastMessage: string; lastMessageAt: string }
) =>
  sortConversations(
    conversations.map((conversation) => (conversation.id === conversationId ? { ...conversation, ...preview } : conversation))
  );

export const mergeConfirmedMessage = (
  messages: Message[],
  optimisticId: string | undefined,
  confirmed: Message
) => {
  let replacedOptimistic = false;
  const next: Message[] = [];

  for (const message of messages) {
    if (message.id === confirmed.id) continue;
    if (message.id === optimisticId) {
      next.push(confirmed);
      replacedOptimistic = true;
      continue;
    }
    next.push(message);
  }

  if (!replacedOptimistic) {
    next.push(confirmed);
  }

  return next;
};

export type MessageReadStatus = 'pending' | 'sent' | 'read';

export function getMessageReadStatus(
  message: Message,
  currentUserId: ID,
  recipientId: string
): MessageReadStatus {
  if (message.pending) return 'pending';
  const readByRecipient = message.readBy.some((id) => id !== currentUserId && id === recipientId);
  return readByRecipient ? 'read' : 'sent';
}
