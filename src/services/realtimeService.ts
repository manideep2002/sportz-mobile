import type { RealtimeChannel } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/domain';

interface RealtimeMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export const realtimeService = {
  subscribeToConversation(conversationId: string, onMessage: (message: Message) => void): RealtimeChannel | null {
    if (!env.isSupabaseConfigured) return null;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          onMessage({
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.sender_id,
            body: row.body,
            createdAt: row.created_at,
            readBy: []
          });
        }
      )
      .subscribe();

    return channel;
  },

  subscribeToTyping(
    conversationId: string,
    currentUserId: string,
    onTyping: (userId: string, isTyping: boolean) => void
  ): RealtimeChannel | null {
    if (!env.isSupabaseConfigured || !currentUserId) return null;

    const channel = supabase
      .channel(`typing:${conversationId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const typingPayload = payload as { userId?: string; isTyping?: boolean };
        if (!typingPayload.userId || typingPayload.userId === currentUserId) return;
        onTyping(typingPayload.userId, Boolean(typingPayload.isTyping));
      })
      .subscribe();

    return channel;
  },

  sendTyping(channel: RealtimeChannel | null, userId: string, isTyping: boolean) {
    if (!channel || !userId) return;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, isTyping }
    });
  },

  unsubscribe(channel: RealtimeChannel | null) {
    if (!channel) return;
    supabase.removeChannel(channel);
  }
};
