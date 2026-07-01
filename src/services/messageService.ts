import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { Conversation, Message } from '@/types/domain';
import { sortConversations } from '@/utils/conversation';
import { buildConversationPreview } from '@/utils/messages';

/** Shape of a raw row returned from `conversation_members` with the joined conversation. */
interface ConversationMemberRow {
  conversation_id: string;
  last_read_at: string | null;
  conversations: {
    title: string | null;
    is_group: boolean | null;
    last_message: string | null;
    updated_at: string | null;
  } | null;
}

/** Shape of a member row joined with their profile. */
interface ConversationParticipantRow {
  user_id: string;
  profiles: {
    id: string | null;
    username: string | null;
    display_name: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    primary_sport: string | null;
    sports: string[] | null;
    skill_level: string | null;
    avatar_url: string | null;
    is_online?: boolean | null;
  } | null;
}

/** Shape of a raw message row returned from the `messages` table. */
interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  message_receipts: { user_id: string }[];
}

/** Derive compact initials from a display name string. */
const initialsFromName = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const isExactDirectConversation = async (
  conversationId: string,
  currentUserId: string,
  otherUserId: string
) => {
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('is_group')
    .eq('id', conversationId)
    .single();
  if (conversationError) throw conversationError;
  if (conversation?.is_group) return false;

  const { data: members, error: membersError } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);
  if (membersError) throw membersError;

  const memberIds = new Set((members ?? []).map((member) => member.user_id as string));
  return memberIds.size === 2 && memberIds.has(currentUserId) && memberIds.has(otherUserId);
};

const createDirectConversationRows = async (currentUserId: string, otherUserId: string) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', otherUserId)
    .single();
  if (profileError) throw profileError;

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      is_group: false,
      created_by: currentUserId,
      title: profile?.display_name ?? 'Conversation',
      last_message: ''
    })
    .select('id')
    .single();
  if (conversationError) throw conversationError;

  const { error: membersError } = await supabase.from('conversation_members').insert([
    { conversation_id: conversation.id, user_id: currentUserId },
    { conversation_id: conversation.id, user_id: otherUserId }
  ]);
  if (membersError) throw membersError;

  return conversation.id as string;
};

export const messageService = {
  async getConversation(conversationId: string): Promise<Conversation | null> {
    assertSupabaseConfigured();

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
        ? (members as unknown as ConversationParticipantRow[]).map((member) => ({
            id: member.profiles?.id ?? member.user_id,
            username: member.profiles?.username ?? 'athlete',
            displayName: member.profiles?.display_name ?? 'Athlete',
            initials: initialsFromName(member.profiles?.display_name ?? 'Athlete'),
            avatarUrl: member.profiles?.avatar_url ?? null,
            bio: member.profiles?.bio ?? '',
            city: member.profiles?.city ?? '',
            country: member.profiles?.country ?? 'IN',
            primarySport: member.profiles?.primary_sport ?? 'Basketball',
            sports: member.profiles?.sports ?? [],
            skillLevel: (member.profiles?.skill_level as Conversation['participants'][number]['skillLevel']) ?? 'Intermediate',
            isOnline: Boolean(member.profiles?.is_online),
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

  /**
   * List all conversations for the current user.
   *
   * @param readConversationIds - IDs that have been locally marked as read
   *   (sourced from `useMessagingStore`). Keeps unread badge zeroed without
   *   waiting for a DB round-trip.
   */
  async listConversations(readConversationIds: Set<string> = new Set()): Promise<Conversation[]> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return [];

    const { data, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at, conversations(*)')
      .eq('user_id', authData.user.id)
      .order('conversation_id');

    if (error || !data) return [];

    const rows = data as unknown as ConversationMemberRow[];
    const conversationIds = rows.map((r) => r.conversation_id);

    // Single bulk query for unread counts instead of one COUNT per conversation
    const { data: unreadRows } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', authData.user.id)
      .gt(
        'created_at',
        // Use the earliest last_read_at so we fetch a superset; filter per-row below
        rows.reduce(
          (min, r) => (r.last_read_at && r.last_read_at < min ? r.last_read_at : min),
          '1970-01-01T00:00:00.000Z'
        )
      );

    // Build a per-conversation unread count map from the bulk result
    const unreadCountMap = new Map<string, number>();
    for (const msg of unreadRows ?? []) {
      unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) ?? 0) + 1);
    }

    const mapped = rows.map((row) => ({
      id: row.conversation_id,
      title: row.conversations?.title ?? 'Conversation',
      participants: [],
      isGroup: Boolean(row.conversations?.is_group),
      lastMessage: row.conversations?.last_message ?? '',
      lastMessageAt: row.conversations?.updated_at ?? new Date().toISOString(),
      unreadCount: readConversationIds.has(row.conversation_id)
        ? 0
        : (unreadCountMap.get(row.conversation_id) ?? 0)
    }));

    return sortConversations(mapped);
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('messages')
      .select('*, message_receipts(user_id)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error || !data) return [];

    return (data as unknown as MessageRow[]).map((message) => {
      const receiptUserIds = (message.message_receipts ?? []).map(
        (receipt) => receipt.user_id
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
    assertSupabaseConfigured();

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
    assertSupabaseConfigured();

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
    assertSupabaseConfigured();

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
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to start a conversation.');
    if (authData.user.id === otherUserId) throw new Error('Choose another player to message.');

    const { data, error } = await supabase.rpc('create_direct_conversation', {
      other_user_id: otherUserId
    });
    if (error) throw error;
    if (!data) throw new Error('Could not start a conversation.');
    const conversationId = data as string;
    const isValidDirect = await isExactDirectConversation(conversationId, authData.user.id, otherUserId);
    if (isValidDirect) return conversationId;

    return createDirectConversationRows(authData.user.id, otherUserId);
  },

  async updateMessage(messageId: string, body: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to edit messages.');

    const { error } = await supabase
      .from('messages')
      .update({ body, edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', authData.user.id);
    if (error) throw error;
  },

  async deleteMessage(messageId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to delete messages.');

    const { error } = await supabase
      .from('messages')
      .update({ body: '[deleted]', edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', authData.user.id);
    if (error) throw error;
  }
};
