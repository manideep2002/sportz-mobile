import { create } from 'zustand';

interface MessagingState {
  mutedConversations: Record<string, boolean>;
  toggleMuteConversation: (conversationId: string) => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  mutedConversations: {},
  toggleMuteConversation: (conversationId) =>
    set((state) => ({
      mutedConversations: {
        ...state.mutedConversations,
        [conversationId]: !state.mutedConversations[conversationId]
      }
    }))
}));
