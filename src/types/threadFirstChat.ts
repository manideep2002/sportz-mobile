export type ChatMessageType = 'text' | 'image' | 'video';

export type ChatDeliveryStatus = 'sending' | 'sent' | 'failed';

export interface ThreadChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  messageType: ChatMessageType;
  body: string | null;
  mediaUrl: string | null;
  mediaPath: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaMimeType: string | null;
  createdAt: string;
  editedAt: string | null;
  deliveryStatus?: ChatDeliveryStatus;
}

export interface ThreadChatParticipant {
  roomId: string;
  userId: string;
  lastReadAt: string | null;
  isActive: boolean;
  role: 'owner' | 'admin' | 'member';
}

export interface ChatMessageBroadcastPayload {
  message: ThreadChatMessage;
}

export interface ChatMessageDeletedBroadcastPayload {
  roomId: string;
  messageId: string;
}

export interface ChatReadBroadcastPayload {
  roomId: string;
  userId: string;
  lastReadAt: string;
}

export interface ChatTypingBroadcastPayload {
  roomId: string;
  userId: string;
  isTyping: boolean;
}
