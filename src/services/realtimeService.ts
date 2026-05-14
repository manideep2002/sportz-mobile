import type { RealtimeChannel } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/domain';

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
          const row = payload.new as any;
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

  unsubscribe(channel: RealtimeChannel | null) {
    if (!channel) return;
    supabase.removeChannel(channel);
  }
};
