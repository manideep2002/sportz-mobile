import * as FileSystem from 'expo-file-system/legacy';
import type * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { ChatParticipantRole, Conversation, Message, UserProfile } from '@/types/domain';
import type { ChatMessageType, ThreadChatMessage, ThreadChatParticipant } from '@/types/threadFirstChat';

interface ChatRoomRow {
  id: string;
  room_kind: 'direct' | 'group';
  title: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  updated_at: string;
  created_at: string;
}

interface ChatMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: ChatMessageType;
  body: string | null;
  media_url: string | null;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
  media_mime_type: string | null;
  created_at: string;
  edited_at: string | null;
}

interface ChatParticipantRow {
  room_id: string;
  user_id: string;
  last_read_at: string | null;
  is_active: boolean;
  role?: string | null;
  muted_until?: string | null;
  is_pinned?: boolean | null;
}

interface ProfileRow {
  id: string;
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
}

interface ChatMediaUpload {
  mediaUrl: string;
  mediaPath: string;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaMimeType: string;
}

interface MessagePageCursor {
  createdAt: string;
  id: string;
}

const PAGE_SIZE = 20;
const CHAT_MEDIA_BUCKET = 'chat-media';
const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm']);

const initialsFromName = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const mapProfileRow = (row: ProfileRow): UserProfile => ({
  id: row.id,
  username: row.username ?? 'athlete',
  displayName: row.display_name ?? 'Athlete',
  initials: initialsFromName(row.display_name ?? row.username ?? 'Athlete'),
  avatarUrl: row.avatar_url ?? null,
  bio: row.bio ?? '',
  city: row.city ?? '',
  country: row.country ?? 'IN',
  primarySport: row.primary_sport ?? 'Basketball',
  sports: row.sports ?? [],
  skillLevel: (row.skill_level as UserProfile['skillLevel']) ?? 'Intermediate',
  isOnline: Boolean(row.is_online),
  badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
});

const mapMessageRow = (row: ChatMessageRow): ThreadChatMessage => ({
  id: row.id,
  roomId: row.room_id,
  senderId: row.sender_id,
  messageType: row.message_type,
  body: row.body,
  mediaUrl: row.media_url,
  mediaPath: row.media_path,
  mediaWidth: row.media_width,
  mediaHeight: row.media_height,
  mediaMimeType: row.media_mime_type,
  createdAt: row.created_at,
  editedAt: row.edited_at,
  deliveryStatus: 'sent'
});

const mapParticipantRow = (row: ChatParticipantRow): ThreadChatParticipant => ({
  roomId: row.room_id,
  userId: row.user_id,
  lastReadAt: row.last_read_at,
  isActive: row.is_active,
  role: (row.role as ChatParticipantRole) ?? 'member'
});

const threadMessageBody = (message: ThreadChatMessage) => {
  if (message.messageType === 'image') return message.mediaUrl ? `[media:${message.mediaUrl}]` : '[media]';
  if (message.messageType === 'video') return message.mediaUrl ? `[media:${message.mediaUrl}]` : '[media]';
  return message.body ?? '';
};

const mapDomainMessage = (message: ThreadChatMessage): Message => ({
  id: message.id,
  conversationId: message.roomId,
  senderId: message.senderId,
  body: threadMessageBody(message),
  createdAt: message.createdAt,
  readBy: [message.senderId],
  pending: message.deliveryStatus === 'sending',
  editedAt: message.editedAt
});

const roomSortTime = (room: ChatRoomRow) => room.last_message_at ?? room.updated_at ?? room.created_at;

const directConversationKey = (conversation: Conversation, currentUserId: string) => {
  if (conversation.isGroup) return conversation.id;

  const participantIds = Array.from(new Set(conversation.participants.map((participant) => participant.id))).sort();
  if (participantIds.length !== 2 || !participantIds.includes(currentUserId)) return conversation.id;

  return participantIds.join(':');
};

const mergeDuplicateDirectConversations = (conversations: Conversation[], currentUserId: string) => {
  const byKey = new Map<string, Conversation>();

  for (const conversation of conversations) {
    const key = directConversationKey(conversation, currentUserId);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, conversation);
      continue;
    }

    const conversationTime = new Date(conversation.lastMessageAt).getTime();
    const existingTime = new Date(existing.lastMessageAt).getTime();
    const winner = conversationTime > existingTime ? conversation : existing;

    byKey.set(key, {
      ...winner,
      unreadCount: existing.unreadCount + conversation.unreadCount
    });
  }

  return Array.from(byKey.values());
};

const getSignedInUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You must be signed in.');
  return data.user.id;
};

const fetchProfilesById = async (userIds: string[]) => {
  if (!userIds.length) return new Map<string, UserProfile>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, city, country, primary_sport, sports, skill_level, avatar_url, is_online')
    .in('id', Array.from(new Set(userIds)));

  if (error) throw error;

  const profiles = new Map<string, UserProfile>();
  for (const profile of (data ?? []) as ProfileRow[]) {
    profiles.set(profile.id, mapProfileRow(profile));
  }
  return profiles;
};

const conversationTitle = (room: ChatRoomRow, participants: UserProfile[], currentUserId: string) => {
  if (room.room_kind === 'group') return room.title ?? 'Group chat';
  return participants.find((participant) => participant.id !== currentUserId)?.displayName ?? room.title ?? 'Chat';
};

const createUuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = (Math.random() * 16) | 0;
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const mimeFromExt = (ext: string) => {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    webm: 'video/webm'
  };
  return mimeTypes[ext] ?? 'image/jpeg';
};

const resolveExtAndMime = (asset: ImagePicker.ImagePickerAsset) => {
  if (asset.mimeType) {
    const mime = asset.mimeType;
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    return { ext, mime };
  }

  const lastSegment = asset.uri.split('/').pop() ?? '';
  const rawExt = lastSegment.includes('.') ? lastSegment.split('.').pop()?.toLowerCase() : undefined;
  const ext = rawExt && /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt.replace('jpeg', 'jpg') : 'jpg';
  return { ext, mime: mimeFromExt(ext) };
};

const readFileAsArrayBuffer = async (uri: string) => {
  if (Platform.OS === 'android') {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  const response = await fetch(uri);
  return response.arrayBuffer();
};

const sortByNewestFirst = (messages: ThreadChatMessage[]) =>
  [...messages].sort((a, b) => {
    const byCreatedAt = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return byCreatedAt || b.id.localeCompare(a.id);
  });

export const mergeThreadMessages = (
  current: ThreadChatMessage[],
  incoming: ThreadChatMessage | ThreadChatMessage[]
) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  const nextMessages = Array.isArray(incoming) ? incoming : [incoming];

  for (const message of nextMessages) {
    byId.set(message.id, { ...byId.get(message.id), ...message });
  }

  return sortByNewestFirst(Array.from(byId.values()));
};

export const removeThreadMessage = (current: ThreadChatMessage[], messageId: string) =>
  current.filter((message) => message.id !== messageId);

export const threadFirstChatService = {
  pageSize: PAGE_SIZE,
  createMessageId: createUuid,

  async getConversation(roomId: string): Promise<Conversation | null> {
    if (!env.isSupabaseConfigured) return null;

    const currentUserId = await getSignedInUserId();
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('id, room_kind, title, last_message_preview, last_message_at, updated_at, created_at')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!room) return null;

    const { data: participantRows, error: participantError } = await supabase
      .from('chat_participants')
      .select('room_id, user_id, last_read_at, is_active, role, muted_until, is_pinned')
      .eq('room_id', roomId)
      .eq('is_active', true);

    if (participantError) throw participantError;

    const profilesById = await fetchProfilesById((participantRows ?? []).map((row) => row.user_id as string));
    const participants = ((participantRows ?? []) as ChatParticipantRow[])
      .map((participant) => profilesById.get(participant.user_id))
      .filter((profile): profile is UserProfile => Boolean(profile));
    const memberships = (participantRows ?? []) as ChatParticipantRow[];
    const currentMembership = memberships.find((participant) => participant.user_id === currentUserId);
    const participantRoles = Object.fromEntries(
      memberships.map((participant) => [participant.user_id, (participant.role as ChatParticipantRole) ?? 'member'])
    );
    const roomRow = room as ChatRoomRow;

    return {
      id: roomRow.id,
      title: conversationTitle(roomRow, participants, currentUserId),
      participants,
      isGroup: roomRow.room_kind === 'group',
      lastMessage: roomRow.last_message_preview ?? '',
      lastMessageAt: roomSortTime(roomRow),
      unreadCount: 0,
      pinned: Boolean(currentMembership?.is_pinned),
      muted: Boolean(
        currentMembership?.muted_until && new Date(currentMembership.muted_until).getTime() > Date.now()
      ),
      currentUserRole: (currentMembership?.role as ChatParticipantRole) ?? 'member',
      participantRoles
    };
  },

  async listConversations(readRoomIds: Set<string> = new Set()): Promise<Conversation[]> {
    if (!env.isSupabaseConfigured) return [];

    const currentUserId = await getSignedInUserId();
    const { data: memberRows, error: memberError } = await supabase
      .from('chat_participants')
      .select('room_id, user_id, last_read_at, is_active, role, muted_until, is_pinned')
      .eq('user_id', currentUserId)
      .eq('is_active', true);

    if (memberError) throw memberError;
    const currentMemberships = (memberRows ?? []) as ChatParticipantRow[];
    const roomIds = currentMemberships.map((row) => row.room_id);
    if (!roomIds.length) return [];

    const [{ data: roomRows, error: roomError }, { data: allParticipantRows, error: participantsError }] =
      await Promise.all([
        supabase
          .from('chat_rooms')
          .select('id, room_kind, title, last_message_preview, last_message_at, updated_at, created_at')
          .in('id', roomIds),
        supabase
          .from('chat_participants')
          .select('room_id, user_id, last_read_at, is_active, role')
          .in('room_id', roomIds)
          .eq('is_active', true)
      ]);

    if (roomError) throw roomError;
    if (participantsError) throw participantsError;

    const allParticipants = (allParticipantRows ?? []) as ChatParticipantRow[];
    const profilesById = await fetchProfilesById(allParticipants.map((row) => row.user_id));
    const participantsByRoom = new Map<string, UserProfile[]>();
    for (const participant of allParticipants) {
      const profile = profilesById.get(participant.user_id);
      if (!profile) continue;
      const roomParticipants = participantsByRoom.get(participant.room_id) ?? [];
      roomParticipants.push(profile);
      participantsByRoom.set(participant.room_id, roomParticipants);
    }

    const { data: incomingRows, error: incomingError } = await supabase
      .from('chat_messages')
      .select('room_id, created_at')
      .in('room_id', roomIds)
      .neq('sender_id', currentUserId)
      .is('deleted_at', null);

    if (incomingError) throw incomingError;

    const membershipByRoom = new Map(currentMemberships.map((row) => [row.room_id, row]));
    const unreadByRoom = new Map<string, number>();
    for (const message of incomingRows ?? []) {
      const membership = membershipByRoom.get(message.room_id);
      if (!membership) continue;
      const lastReadAt = membership.last_read_at ?? '1970-01-01T00:00:00.000Z';
      if (message.created_at <= lastReadAt) continue;
      unreadByRoom.set(message.room_id, (unreadByRoom.get(message.room_id) ?? 0) + 1);
    }

    const conversations = ((roomRows ?? []) as ChatRoomRow[]).map((room) => {
      const participants = participantsByRoom.get(room.id) ?? [];
      const membership = membershipByRoom.get(room.id);
      return {
        id: room.id,
        title: conversationTitle(room, participants, currentUserId),
        participants,
        isGroup: room.room_kind === 'group',
        lastMessage: room.last_message_preview ?? '',
        lastMessageAt: roomSortTime(room),
        unreadCount: readRoomIds.has(room.id) ? 0 : unreadByRoom.get(room.id) ?? 0,
        pinned: Boolean(membership?.is_pinned),
        muted: Boolean(membership?.muted_until && new Date(membership.muted_until).getTime() > Date.now()),
        currentUserRole: (membership?.role as ChatParticipantRole) ?? 'member'
      };
    });

    return mergeDuplicateDirectConversations(conversations, currentUserId).sort(
      (left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
    );
  },

  async listMessages(roomId: string, before?: MessagePageCursor): Promise<ThreadChatMessage[]> {
    if (!env.isSupabaseConfigured) return [];

    let request = supabase
      .from('chat_messages')
      .select('id, room_id, sender_id, message_type, body, media_url, media_path, media_width, media_height, media_mime_type, created_at, edited_at')
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);

    if (before) {
      request = request.or(
        `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`
      );
    }

    const { data, error } = await request;
    if (error) throw error;
    return ((data ?? []) as ChatMessageRow[]).map(mapMessageRow);
  },

  async listParticipants(roomId: string): Promise<ThreadChatParticipant[]> {
    if (!env.isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('chat_participants')
      .select('room_id, user_id, last_read_at, is_active, role')
      .eq('room_id', roomId)
      .eq('is_active', true);

    if (error) throw error;
    return ((data ?? []) as ChatParticipantRow[]).map(mapParticipantRow);
  },

  async insertMessage(message: ThreadChatMessage): Promise<ThreadChatMessage> {
    const { data, error } = await supabase
      .rpc('send_chat_message', {
        target_room_id: message.roomId,
        client_message_id: message.id,
        target_message_type: message.messageType,
        message_body: message.body,
        target_media_url: message.mediaUrl,
        target_media_path: message.mediaPath,
        target_media_width: message.mediaWidth,
        target_media_height: message.mediaHeight,
        target_media_mime_type: message.mediaMimeType
      });

    if (error) throw error;
    return mapMessageRow(data as ChatMessageRow);
  },

  async listDomainMessages(roomId: string): Promise<Message[]> {
    const messages = await this.listMessages(roomId);
    return messages
      .slice()
      .reverse()
      .map(mapDomainMessage);
  },

  async sendTextMessage(roomId: string, body: string): Promise<Message> {
    const currentUserId = await getSignedInUserId();
    const message = await this.insertMessage({
      id: createUuid(),
      roomId,
      senderId: currentUserId,
      messageType: 'text',
      body,
      mediaUrl: null,
      mediaPath: null,
      mediaWidth: null,
      mediaHeight: null,
      mediaMimeType: null,
      createdAt: new Date().toISOString(),
      editedAt: null
    });

    return mapDomainMessage({
      ...message,
      body: message.body ?? body
    });
  },

  async markRead(roomId: string, lastReadAt: string): Promise<ThreadChatParticipant> {
    const { data, error } = await supabase.rpc('mark_chat_room_read', {
      target_room_id: roomId,
      read_at: lastReadAt
    });

    if (error) throw error;
    return mapParticipantRow(data as ChatParticipantRow);
  },

  async markRoomRead(roomId: string): Promise<void> {
    await this.markRead(roomId, new Date().toISOString());
  },

  async createDirectRoom(otherUserId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_direct_chat_room', {
      other_user_id: otherUserId
    });
    if (error) throw error;
    if (!data) throw new Error('Could not start a chat.');
    return data as string;
  },

  async createGroupRoom(title: string, memberIds: string[]): Promise<string> {
    const { data, error } = await supabase.rpc('create_group_chat_room', {
      group_title: title,
      member_ids: memberIds
    });
    if (error) throw error;
    if (!data) throw new Error('Could not create the group chat.');
    return data as string;
  },

  async addRoomMembers(roomId: string, memberIds: string[]): Promise<void> {
    if (!memberIds.length) return;
    const { error } = await supabase.rpc('add_chat_room_members', {
      target_room_id: roomId,
      member_ids: memberIds
    });
    if (error) throw error;
  },

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_chat_room_member', {
      target_room_id: roomId,
      target_user_id: userId
    });
    if (error) throw error;
  },

  async leaveRoom(roomId: string): Promise<void> {
    await this.removeRoomMember(roomId, await getSignedInUserId());
  },

  async setRoomMuted(roomId: string, muted: boolean): Promise<void> {
    const currentUserId = await getSignedInUserId();
    const { error } = await supabase
      .from('chat_participants')
      .update({ muted_until: muted ? '9999-12-31T23:59:59.999Z' : null })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    if (error) throw error;
  },

  async setRoomPinned(roomId: string, pinned: boolean): Promise<void> {
    const currentUserId = await getSignedInUserId();
    const { error } = await supabase
      .from('chat_participants')
      .update({ is_pinned: pinned })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    if (error) throw error;
  },

  async updateMessage(messageId: string, body: string): Promise<ThreadChatMessage> {
    const { data, error } = await supabase.rpc('edit_chat_message', {
      target_message_id: messageId,
      message_body: body
    });

    if (error) throw error;
    return mapMessageRow(data as ChatMessageRow);
  },

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_chat_message', {
      target_message_id: messageId
    });

    if (error) throw error;
  },

  async uploadChatMedia(
    asset: ImagePicker.ImagePickerAsset,
    roomId: string,
    userId: string,
    messageId: string
  ): Promise<ChatMediaUpload> {
    if (!env.isSupabaseConfigured) {
      return {
        mediaUrl: asset.uri,
        mediaPath: '',
        mediaWidth: asset.width ?? null,
        mediaHeight: asset.height ?? null,
        mediaMimeType: asset.mimeType ?? 'image/jpeg'
      };
    }

    const { ext, mime } = resolveExtAndMime(asset);
    const safeExt = ext === 'quicktime' ? 'mov' : ext;
    const path = `${roomId}/${userId}/${messageId}.${safeExt}`;
    const fileData = await readFileAsArrayBuffer(asset.uri);

    const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, fileData, {
      cacheControl: '31536000',
      contentType: VIDEO_EXTS.has(safeExt) ? mimeFromExt(safeExt) : mime,
      upsert: false
    });

    if (error) throw error;

    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    return {
      mediaUrl: data.publicUrl,
      mediaPath: path,
      mediaWidth: asset.width ?? null,
      mediaHeight: asset.height ?? null,
      mediaMimeType: mime
    };
  },

  getBubbleImageUrl(mediaPath: string | null, fallbackUrl: string | null) {
    if (!mediaPath) return fallbackUrl;

    return supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(mediaPath, {
      transform: {
        width: 360,
        height: 360
      }
    }).data.publicUrl;
  },

  getFullImageUrl(mediaPath: string | null, fallbackUrl: string | null) {
    if (!mediaPath) return fallbackUrl;

    return supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(mediaPath, {
      transform: {
        width: 1440,
        height: 1440
      }
    }).data.publicUrl;
  }
};
