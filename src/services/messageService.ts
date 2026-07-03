import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { Conversation, Message } from '@/types/domain';
import { getOtherParticipant, sortConversations } from '@/utils/conversation';
import { formatConversationPreview, rawConversationPreview } from '@/utils/messages';

/** Shape of a raw row returned from `conversation_members` with the joined conversation. */
interface ConversationMemberRow {
  conversation_id: string;
  last_read_at: string | null;
  cleared_at: string | null;
  conversations: {
    title: string | null;
    is_group: boolean | null;
    last_message: string | null;
    last_sender_id?: string | null;
    updated_at: string | null;
  } | null;
}

/** Shape of a member row joined with their profile. */
interface ConversationParticipantRow {
  conversation_id?: string;
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

interface MessagePreviewRow {
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/** Derive compact initials from a display name string. */
const initialsFromName = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const mapConversationParticipant = (member: ConversationParticipantRow): Conversation['participants'][number] => ({
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
});

const unprefixStoredPreview = (lastMessage: string) =>
  lastMessage.startsWith('You: ') ? lastMessage.slice(5) : lastMessage;

const displayConversationPreview = (
  lastMessage: string | null | undefined,
  lastSenderId: string | null | undefined,
  currentUserId: string
) => {
  if (!lastMessage) return '';
  const neutralMessage = unprefixStoredPreview(lastMessage);
  return formatConversationPreview(neutralMessage, lastSenderId, currentUserId);
};

const dedupeDirectConversations = (conversations: Conversation[], currentUserId: string) => {
  const sorted = sortConversations(conversations);
  const seenDirectKeys = new Set<string>();
  const result: Conversation[] = [];

  for (const conversation of sorted) {
    if (conversation.isGroup) {
      result.push(conversation);
      continue;
    }

    const otherParticipant = getOtherParticipant(conversation, currentUserId);
    const key = otherParticipant?.id ? `direct:${otherParticipant.id}` : `conversation:${conversation.id}`;
    if (seenDirectKeys.has(key)) continue;
    seenDirectKeys.add(key);
    result.push(conversation);
  }

  return result;
};

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

export const messageService = {
  async getConversation(conversationId: string): Promise<Conversation | null> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, is_group, last_message, last_sender_id, updated_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { data: members, error: membersError } = await supabase
      .from('conversation_members')
      .select('user_id, profiles:user_id(*)')
      .eq('conversation_id', conversationId);

    const participants =
      !membersError && members
        ? (members as unknown as ConversationParticipantRow[]).map(mapConversationParticipant)
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
      .select('conversation_id, last_read_at, cleared_at, conversations(*)')
      .eq('user_id', authData.user.id)
      .order('conversation_id');

    if (error) throw error;
    if (!data) return [];

    const rows = data as unknown as ConversationMemberRow[];
    const conversationIds = rows.map((r) => r.conversation_id);
    if (!conversationIds.length) return [];

    const { data: memberRows, error: memberRowsError } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, profiles:user_id(*)')
      .in('conversation_id', conversationIds);
    if (memberRowsError) throw memberRowsError;

    const participantsByConversation = new Map<string, Conversation['participants']>();
    for (const member of (memberRows ?? []) as unknown as ConversationParticipantRow[]) {
      if (!member.conversation_id) continue;
      const participants = participantsByConversation.get(member.conversation_id) ?? [];
      participants.push(mapConversationParticipant(member));
      participantsByConversation.set(member.conversation_id, participants);
    }

    // Single bulk query for unread counts instead of one COUNT per conversation
    const { data: unreadRows, error: unreadError } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', conversationIds)
      .neq('sender_id', authData.user.id);
    if (unreadError) throw unreadError;

    const { data: latestRows, error: latestError } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, body, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });
    if (latestError) throw latestError;

    const lastReadAtByConversation = new Map(
      rows.map((row) => [row.conversation_id, row.last_read_at ?? '1970-01-01T00:00:00.000Z'])
    );
    const clearedAtByConversation = new Map(rows.map((row) => [row.conversation_id, row.cleared_at]));

    const latestMessageByConversation = new Map<string, MessagePreviewRow>();
    for (const message of (latestRows ?? []) as MessagePreviewRow[]) {
      if (latestMessageByConversation.has(message.conversation_id)) continue;
      const clearedAt = clearedAtByConversation.get(message.conversation_id);
      if (clearedAt && message.created_at <= clearedAt) continue;
      latestMessageByConversation.set(message.conversation_id, message);
    }

    const unreadCountMap = new Map<string, number>();
    for (const msg of unreadRows ?? []) {
      const lastReadAt = lastReadAtByConversation.get(msg.conversation_id) ?? '1970-01-01T00:00:00.000Z';
      const clearedAt = clearedAtByConversation.get(msg.conversation_id);
      if (clearedAt && msg.created_at <= clearedAt) continue;
      if (msg.created_at <= lastReadAt) continue;
      unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) ?? 0) + 1);
    }

    const mapped = rows.map((row) => {
      const isGroup = Boolean(row.conversations?.is_group);
      const participants = participantsByConversation.get(row.conversation_id) ?? [];
      const latestMessage = latestMessageByConversation.get(row.conversation_id);
      const conversation: Conversation = {
        id: row.conversation_id,
        title: row.conversations?.title ?? 'Conversation',
        participants,
        isGroup,
        lastMessage: latestMessage
          ? displayConversationPreview(latestMessage.body, latestMessage.sender_id, authData.user.id)
          : '',
        lastMessageAt: latestMessage?.created_at ?? row.cleared_at ?? row.conversations?.updated_at ?? new Date().toISOString(),
        unreadCount: readConversationIds.has(row.conversation_id)
          ? 0
          : (unreadCountMap.get(row.conversation_id) ?? 0)
      };
      const otherParticipant = getOtherParticipant(conversation, authData.user.id);

      return {
        ...conversation,
        title: isGroup ? conversation.title : otherParticipant?.displayName ?? conversation.title
      };
    });

    return dedupeDirectConversations(mapped, authData.user.id);
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    const { data: membership, error: membershipError } = await supabase
      .from('conversation_members')
      .select('cleared_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;

    let request = supabase
      .from('messages')
      .select('*, message_receipts(user_id)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80);
    if (membership?.cleared_at) {
      request = request.gt('created_at', membership.cleared_at);
    }

    const { data, error } = await request;

    if (error) throw error;
    if (!data) return [];

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

    const { data: membership, error: membershipError } = await supabase
      .from('conversation_members')
      .select('cleared_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;

    let unreadRequest = supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', authData.user.id);
    if (membership?.cleared_at) {
      unreadRequest = unreadRequest.gt('created_at', membership.cleared_at);
    }

    const { data: unreadMessages, error: listError } = await unreadRequest;

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

    const { error: conversationUpdateError } = await supabase
      .from('conversations')
      .update({
        last_message: rawConversationPreview(data.body),
        last_sender_id: data.sender_id,
        updated_at: data.created_at
      })
      .eq('id', conversationId);
    if (conversationUpdateError) throw conversationUpdateError;

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

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to clear a conversation.');

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('conversation_members')
      .update({
        cleared_at: now,
        last_read_at: now
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', authData.user.id);
    if (error) throw error;
  },

  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to update chat notifications.');

    if (!muted) {
      const { error } = await supabase
        .from('conversation_mutes')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', authData.user.id);
      if (error && error.code !== '42P01') throw error;
      return;
    }

    const { error } = await supabase.from('conversation_mutes').upsert(
      {
        conversation_id: conversationId,
        user_id: authData.user.id,
        muted_until: null
      },
      { onConflict: 'conversation_id,user_id' }
    );
    if (error && error.code !== '42P01') throw error;
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

    throw new Error('Could not start a safe direct conversation.');
  },

  async createGroupConversation(title: string, memberIds: string[]): Promise<string> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create a group chat.');

    const { data, error } = await supabase.rpc('create_group_conversation', {
      group_title: title,
      member_ids: memberIds
    });
    if (error) throw error;
    if (!data) throw new Error('Could not create the group chat.');
    return data as string;
  },

  async addGroupMembers(conversationId: string, memberIds: string[]): Promise<void> {
    assertSupabaseConfigured();
    if (!memberIds.length) return;

    const { error } = await supabase.rpc('add_group_conversation_members', {
      target_conversation_id: conversationId,
      member_ids: memberIds
    });
    if (error) throw error;
  },

  async removeGroupMember(conversationId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('remove_group_conversation_member', {
      target_conversation_id: conversationId,
      target_user_id: userId
    });
    if (error) throw error;
  },

  async leaveConversation(conversationId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to leave a group.');

    await this.removeGroupMember(conversationId, authData.user.id);
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
