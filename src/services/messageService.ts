import { supabase } from '@/lib/supabase';
import type { Conversation, ID, Message } from '@/types/domain';
import { sortConversations } from '@/utils/conversation';
import { buildConversationPreview } from '@/utils/messages';

const readConversationIds = new Set<string>();

interface ConversationPreview {
  lastMessage: string;
  lastMessageAt: string;
}

const conversationPreviews = new Map<string, ConversationPreview>();

const withReadState = (items: Conversation[]): Conversation[] =>
  items.map((conversation) => ({
    ...conversation,
    unreadCount: readConversationIds.has(conversation.id) ? 0 : conversation.unreadCount
  }));

const withPreviewState = (items: Conversation[]): Conversation[] => {
  const merged = items.map((conversation) => {
    const preview = conversationPreviews.get(conversation.id);
    return preview ? { ...conversation, ...preview } : conversation;
  });
  return sortConversations(merged);
};

const applyConversationListState = (items: Conversation[]) => withPreviewState(withReadState(items));

/** Derive compact initials from a display name string. */
const initialsFromName = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const messageService = {
  recordConversationPreview(conversationId: string, body: string, senderId: ID, createdAt: string) {
    // preview is always stored, UI uses senderId comparison
    const currentUserId = '';
    const preview = buildConversationPreview({ body, senderId, createdAt }, currentUserId);
    conversationPreviews.set(conversationId, preview);
    return preview;
  },

  clearConversationPreview(conversationId: string) {
    conversationPreviews.set(conversationId, {
      lastMessage: 'No messages yet',
      lastMessageAt: new Date().toISOString()
    });
  },

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, is_group, last_message, updated_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !data) return null;

    const { data: members, error: membersError } = await supabase
      .from('conversation_members')
      .select('user_id, profiles:user_id(*)')
      .eq('conversation_id', conversationId);

    const participants =
      !membersError && members
        ? members.map((member: any) => ({
            id: member.profiles?.id ?? member.user_id,
            username: member.profiles?.username ?? 'athlete',
            displayName: member.profiles?.display_name ?? 'Athlete',
            initials: initialsFromName(member.profiles?.display_name ?? 'Athlete'),
            bio: member.profiles?.bio ?? '',
            city: member.profiles?.city ?? '',
            country: member.profiles?.country ?? 'IN',
            primarySport: member.profiles?.primary_sport ?? 'Basketball',
            sports: member.profiles?.sports ?? [],
            skillLevel: member.profiles?.skill_level ?? 'Intermediate',
            isOnline: false,
            badges: [],
            stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
          }))
        : [];

    return {
      id: data.id,
      title: data.title ?? 'Conversation',
      participants,
      isGroup: Boolean(data.is_group),
      lastMessage: data.last_message ?? '',
      lastMessageAt: data.updated_at ?? new Date().toISOString(),
      unreadCount: 0
    };
  },

  async listConversations(): Promise<Conversation[]> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return [];

    const { data, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at, conversations(*)')
      .eq('user_id', authData.user.id)
      .order('conversation_id');

    if (error || !data) return [];

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
          participants: [],
          isGroup: Boolean(row.conversations?.is_group),
          lastMessage: row.conversations?.last_message ?? '',
          lastMessageAt: row.conversations?.updated_at ?? new Date().toISOString(),
          unreadCount: readConversationIds.has(row.conversation_id) ? 0 : countError ? 0 : count ?? 0
        };
      })
    );

    return applyConversationListState(mapped);
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, message_receipts(user_id)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error || !data) return [];

    return data.map((message: any) => {
      const receiptUserIds = (message.message_receipts ?? []).map(
        (receipt: { user_id: string }) => receipt.user_id
      );
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

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;

    const { data: unreadMessages, error: listError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', authData.user.id);

    if (listError || !unreadMessages?.length) return;

    const receipts = unreadMessages.map((message) => ({
      message_id: message.id,
      user_id: authData.user!.id
    }));

    await supabase.from('message_receipts').upsert(receipts, {
      onConflict: 'message_id,user_id'
    });

    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', authData.user.id);
  },

  async sendMessage(conversationId: string, body: string): Promise<Message> {
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

    const preview = buildConversationPreview(
      { body: data.body, senderId: data.sender_id, createdAt: data.created_at },
      authData.user.id
    );
    conversationPreviews.set(conversationId, preview);

    await supabase
      .from('conversations')
      .update({
        last_message: preview.lastMessage,
        updated_at: data.created_at
      })
      .eq('id', conversationId);

    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      body: data.body,
      createdAt: data.created_at,
      readBy: [data.sender_id]
    };
  },

  async clearConversation(conversationId: string): Promise<void> {
    messageService.clearConversationPreview(conversationId);

    const { error } = await supabase.from('messages').delete().eq('conversation_id', conversationId);
    if (error) throw error;

    await supabase
      .from('conversations')
      .update({
        last_message: 'No messages yet',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);
  },

  async createDirectConversation(otherUserId: string): Promise<string> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to start a conversation.');

    // Check if a 1-on-1 conversation already exists
    const { data: existing } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversations!inner(is_group)')
      .eq('user_id', authData.user.id);

    for (const row of existing ?? []) {
      if ((row.conversations as any)?.is_group) continue;
      const { count } = await supabase
        .from('conversation_members')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', row.conversation_id)
        .eq('user_id', otherUserId);
      if ((count ?? 0) > 0) return row.conversation_id;
    }

    // Create new conversation
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', otherUserId)
      .single();

    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        is_group: false,
        title: otherProfile?.display_name ?? 'New Conversation',
        last_message: ''
      })
      .select('id')
      .single();

    if (convError) throw convError;

    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: authData.user.id },
      { conversation_id: conv.id, user_id: otherUserId }
    ]);

    return conv.id;
  },

  /** @deprecated Use Supabase membership instead. Only kept for legacy nav usage. */
  getConversationIdForUser(_userId: ID): string | undefined {
    return undefined;
  }
};
