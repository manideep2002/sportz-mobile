import type { ID } from '@/types/domain';

export const formatConversationPreview = (body: string, senderId: ID, currentUserId: ID) =>
  senderId === currentUserId ? `You: ${body}` : body;
