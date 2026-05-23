import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { conversations, currentUser, messages } from '@/data/mockData';
import type { Conversation, ID, Message } from '@/types/domain';
import { getConversationIdForUser } from '@/utils/conversation';

const readConversationIds = new Set<string>();

const withReadState = (items: Conversation[]): Conversation[] =>
  items.map((conversation) => ({
    ...conversation,
    unreadCount: readConversationIds.has(conversation.id) ? 0 : conversation.unreadCount
  }));

export const messageService = {
  getConversationIdForUser(userId: ID): string | undefined {
    return getConversationIdForUser(conversations, userId);
  },

  async getConversation(conversationId: string): Promise<Conversation | null> {
    if (!env.isSupabaseConfigured) {
      const conversation = conversations.find((item) => item.id === conversationId) ?? null;
      return conversation ? withReadState([conversation])[0] : null;
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, is_group, last_message, updated_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !data) {
      const conversation = conversations.find((item) => item.id === conversationId) ?? null;
      return conversation ? withReadState([conversation])[0] : null;
    }

    const { data: members, error: membersError } = await supabase
      .from('conversation_members')
      .select('user_id, profiles:user_id(*)')
      .eq('conversation_id', conversationId);

    if (membersError || !members) {
      return {
        id: data.id,
        title: data.title ?? 'Conversation',
        participants: [currentUser],
        isGroup: Boolean(data.is_group),
        lastMessage: data.last_message ?? '',
        lastMessageAt: data.updated_at ?? new Date().toISOString(),
        unreadCount: 0
      };
    }

    return {
      id: data.id,
      title: data.title ?? 'Conversation',
      participants: members.map((member: any) => ({
        id: member.profiles?.id ?? member.user_id,
        username: member.profiles?.username ?? 'athlete',
        displayName: member.profiles?.display_name ?? 'Athlete',
        initials: (member.profiles?.display_name ?? 'AT')
          .split(' ')
          .map((part: string) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        bio: member.profiles?.bio ?? '',
        city: member.profiles?.city ?? '',
        country: member.profiles?.country ?? 'IN',
        primarySport: member.profiles?.primary_sport ?? 'Basketball',
        sports: member.profiles?.sports ?? [],
        skillLevel: member.profiles?.skill_level ?? 'Intermediate',
        isOnline: false,
        badges: [],
        stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
      })),
      isGroup: Boolean(data.is_group),
      lastMessage: data.last_message ?? '',
      lastMessageAt: data.updated_at ?? new Date().toISOString(),
      unreadCount: 0
    };
  },

  async listConversations(): Promise<Conversation[]> {
    if (!env.isSupabaseConfigured) return withReadState(conversations);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return withReadState(conversations);

    const { data, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at, conversations(*)')
      .eq('user_id', authData.user.id)
      .order('conversation_id');

    if (error || !data) return withReadState(conversations);

    const mapped = await Promise.all(
      data.map(async (row: any) => {
        const lastReadAt = row.last_read_at ?? '1970-01-01T00:00:00.000Z';
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', row.conversation_id)
          .neq('sender_id', authData.user!.id)
          .gt('created_at', lastReadAt);

        return {
          id: row.conversation_id,
          title: row.conversations?.title ?? 'Conversation',
          participants: [currentUser],
          isGroup: Boolean(row.conversations?.is_group),
          lastMessage: row.conversations?.last_message ?? '',
          lastMessageAt: row.conversations?.updated_at ?? new Date().toISOString(),
          unreadCount: readConversationIds.has(row.conversation_id) ? 0 : countError ? 0 : count ?? 0
        };
      })
    );

    return withReadState(mapped);
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    if (!env.isSupabaseConfigured) {
      return messages.filter((message) => message.conversationId === conversationId);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*, message_receipts(user_id)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error || !data) return messages.filter((message) => message.conversationId === conversationId);

    return data.map((message: any) => {
      const receiptUserIds = (message.message_receipts ?? []).map((receipt: { user_id: string }) => receipt.user_id);
      const readBy = Array.from(new Set([message.sender_id, ...receiptUserIds]));

      return {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
        readBy
      };
    });
  },

  async markConversationRead(conversationId: string): Promise<void> {
    readConversationIds.add(conversationId);

    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { data: unreadMessages, error: listError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', authData.user.id);

    if (listError) throw listError;
    if (!unreadMessages?.length) return;

    const receipts = unreadMessages.map((message) => ({
      message_id: message.id,
      user_id: authData.user!.id
    }));

    const { error: receiptError } = await supabase.from('message_receipts').upsert(receipts, {
      onConflict: 'message_id,user_id'
    });

    if (receiptError) throw receiptError;

    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', authData.user.id);
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
