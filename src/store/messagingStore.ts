import { create } from 'zustand';

interface MessagingState {
  typingByConversation: Record<string, boolean>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  typingByConversation: {},
  setTyping: (conversationId, isTyping) =>
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: isTyping
      }
    }))
}));
