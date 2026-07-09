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
  deliveryStatus?: ChatDeliveryStatus;
}

export interface ThreadChatParticipant {
  roomId: string;
  userId: string;
  lastReadAt: string | null;
  isActive: boolean;
}

export interface ChatMessageBroadcastPayload {
  message: ThreadChatMessage;
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
