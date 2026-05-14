import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { conversations, currentUser, messages } from '@/data/mockData';
import type { Conversation, Message } from '@/types/domain';

export const messageService = {
  async listConversations(): Promise<Conversation[]> {
    if (!env.isSupabaseConfigured) return conversations;

    const { data, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversations(*)')
      .order('conversation_id');

    if (error || !data) return conversations;

    return data.map((row: any) => ({
      id: row.conversation_id,
      title: row.conversations?.title ?? 'Conversation',
      participants: [currentUser],
      isGroup: Boolean(row.conversations?.is_group),
      lastMessage: row.conversations?.last_message ?? '',
      lastMessageAt: row.conversations?.updated_at ?? new Date().toISOString(),
      unreadCount: 0
    }));
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    if (!env.isSupabaseConfigured) {
      return messages.filter((message) => message.conversationId === conversationId);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error || !data) return messages.filter((message) => message.conversationId === conversationId);

    return data.map((message) => ({
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      body: message.body,
      createdAt: message.created_at,
      readBy: []
    }));
  },

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    if (!env.isSupabaseConfigured) {
      return {
        id: `local-message-${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        body,
        createdAt: new Date().toISOString(),
        readBy: [currentUser.id],
        pending: true
      };
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to message.');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: authData.user.id,
        body
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      body: data.body,
      createdAt: data.created_at,
      readBy: [data.sender_id]
    };
  },

  async setTyping(conversationId: string, isTyping: boolean): Promise<void> {
    if (!env.isSupabaseConfigured) return;
    const channel = supabase.channel(`typing:${conversationId}`);
    await channel.track({ typing: isTyping, at: new Date().toISOString() });
  }
};
