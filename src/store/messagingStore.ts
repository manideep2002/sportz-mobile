import { create } from 'zustand';

interface MessagingState {
  typingByConversation: Record<string, boolean>;
  mutedConversations: Record<string, boolean>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  toggleMuteConversation: (conversationId: string) => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  typingByConversation: {},
  mutedConversations: {},
  setTyping: (conversationId, isTyping) =>
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: isTyping
      }
    })),
  toggleMuteConversation: (conversationId) =>
    set((state) => ({
      mutedConversations: {
        ...state.mutedConversations,
        [conversationId]: !state.mutedConversations[conversationId]
      }
    }))
}));
