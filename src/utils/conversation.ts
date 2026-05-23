import type { Conversation, ID, UserProfile } from '@/types/domain';

export const sortConversations = (items: Conversation[]) =>
  [...items].sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());

export function getOtherParticipant(conversation: Conversation, currentUserId: ID): UserProfile | undefined {
  if (conversation.isGroup) return undefined;
  return conversation.participants.find((participant) => participant.id !== currentUserId);
}

export function getParticipantById(conversation: Conversation, userId: ID): UserProfile | undefined {
  return conversation.participants.find((participant) => participant.id === userId);
}

export function getConversationIdForUser(conversations: Conversation[], userId: ID): string | undefined {
  return conversations.find(
    (conversation) => !conversation.isGroup && conversation.participants.some((participant) => participant.id === userId)
  )?.id;
}
