import { create } from 'zustand';

interface ConversationPreview {
  lastMessage: string;
  lastMessageAt: string;
}

interface MessagingState {
  mutedConversations: Record<string, boolean>;
  /** Conversations the user has explicitly opened/read in this session. */
  readConversationIds: Set<string>;
  /** Optimistic last-message previews written before the server round-trip completes. */
  conversationPreviews: Map<string, ConversationPreview>;
  toggleMuteConversation: (conversationId: string) => void;
  setConversationMutedLocally: (conversationId: string, muted: boolean) => void;
  markConversationReadLocally: (conversationId: string) => void;
  setConversationPreview: (conversationId: string, preview: ConversationPreview) => void;
  clearConversationPreview: (conversationId: string) => void;
  resetForSession: () => void;
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  mutedConversations: {},
  readConversationIds: new Set<string>(),
  conversationPreviews: new Map<string, ConversationPreview>(),

  toggleMuteConversation: (conversationId) =>
    set((state) => ({
      mutedConversations: {
        ...state.mutedConversations,
        [conversationId]: !state.mutedConversations[conversationId]
      }
    })),

  setConversationMutedLocally: (conversationId, muted) =>
    set((state) => ({
      mutedConversations: {
        ...state.mutedConversations,
        [conversationId]: muted
      }
    })),

  markConversationReadLocally: (conversationId) =>
    set((state) => {
      const next = new Set(state.readConversationIds);
      next.add(conversationId);
      return { readConversationIds: next };
    }),

  setConversationPreview: (conversationId, preview) =>
    set((state) => {
      const next = new Map(state.conversationPreviews);
      next.set(conversationId, preview);
      return { conversationPreviews: next };
    }),

  clearConversationPreview: (conversationId) =>
    set((state) => {
      const next = new Map(state.conversationPreviews);
      next.set(conversationId, {
        lastMessage: 'No messages yet',
        lastMessageAt: new Date().toISOString()
      });
      return { conversationPreviews: next };
    }),

  resetForSession: () =>
    set({
      mutedConversations: {},
      readConversationIds: new Set<string>(),
      conversationPreviews: new Map<string, ConversationPreview>()
    })
}));
