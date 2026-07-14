import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Clock,
  Edit3,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  Send,
  Trash2,
  Video,
  X
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewToken
} from 'react-native';

import { ConversationSettingsSheet } from '@/components/messages/ConversationSettingsSheet';
import { AppText, BottomSheet, Button, IconButton } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { messageKeys } from '@/hooks/useMessages';
import { supabase } from '@/lib/supabase';
import { messageService } from '@/services/messageService';
import {
  mergeThreadMessages,
  removeThreadMessage,
  threadFirstChatService
} from '@/services/threadFirstChatService';
import { useAuthStore } from '@/store/authStore';
import { useMessagingStore } from '@/store/messagingStore';
import type { ChatParticipantRole, Conversation, UserProfile } from '@/types/domain';
import type {
  ChatMessageBroadcastPayload,
  ChatMessageDeletedBroadcastPayload,
  ChatReadBroadcastPayload,
  ChatTypingBroadcastPayload,
  ThreadChatMessage,
  ThreadChatParticipant
} from '@/types/threadFirstChat';

interface ThreadFirstChatScreenProps {
  roomId: string;
  title?: string;
  conversation?: Conversation;
  initialOpenSettings?: boolean;
  onAddMembers?: () => void;
  onBack?: () => void;
  onLeftConversation?: () => void;
}

const newestFirst = (a: ThreadChatMessage, b: ThreadChatMessage) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const isAtLeastReadThrough = (messageCreatedAt: string, lastReadAt: string | null | undefined) =>
  Boolean(lastReadAt && new Date(lastReadAt).getTime() >= new Date(messageCreatedAt).getTime());

function MessageMedia({ message }: { message: ThreadChatMessage }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const bubbleUrl = threadFirstChatService.getBubbleImageUrl(message.mediaPath, message.mediaUrl);
  const fullUrl = threadFirstChatService.getFullImageUrl(message.mediaPath, message.mediaUrl);

  if (message.messageType === 'video') {
    return (
      <View style={styles.videoBubble}>
        <Video size={24} color={colors.light[0]} />
        <AppText style={styles.videoText}>Video</AppText>
      </View>
    );
  }

  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open photo" onPress={() => setViewerOpen(true)}>
        <ExpoImage
          source={{ uri: bubbleUrl ?? undefined }}
          style={styles.media}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      </Pressable>
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setViewerOpen(false)}>
          <ExpoImage
            source={{ uri: fullUrl ?? undefined }}
            style={styles.viewerImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Pressable>
      </Modal>
    </>
  );
}

function MessageBubble({
  message,
  currentUserId,
  showSeen,
  onLongPress
}: {
  message: ThreadChatMessage;
  currentUserId: string;
  showSeen: boolean;
  onLongPress?: () => void;
}) {
  const mine = message.senderId === currentUserId;
  const deliveryLabel =
    message.deliveryStatus === 'sending'
      ? 'Sending'
      : message.deliveryStatus === 'failed'
        ? 'Failed'
        : showSeen
          ? 'Seen'
          : 'Sent';
  const statusLabel = `${message.editedAt ? 'Edited · ' : ''}${deliveryLabel}`;

  return (
    <View style={[styles.messageRow, mine ? styles.myMessageRow : null]}>
      <Pressable
        accessibilityRole={onLongPress ? 'button' : undefined}
        accessibilityLabel={onLongPress ? 'Your message. Long press for actions.' : undefined}
        delayLongPress={320}
        disabled={!onLongPress}
        onLongPress={onLongPress}
        style={({ pressed }) => (pressed && onLongPress ? styles.bubblePressed : null)}
      >
        <View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble, message.mediaUrl ? styles.mediaBubble : null]}>
          {message.messageType === 'text' ? (
            <AppText style={[styles.messageText, mine ? styles.myMessageText : null]}>{message.body}</AppText>
          ) : (
            <MessageMedia message={message} />
          )}
        </View>
      </Pressable>
      {mine ? (
        <View style={styles.messageMeta}>
          {message.deliveryStatus === 'sending' ? <Clock size={11} color={colors.text.tertiary} /> : null}
          <AppText style={[styles.messageMetaText, showSeen ? styles.seenText : null]}>{statusLabel}</AppText>
        </View>
      ) : message.editedAt ? <AppText style={styles.messageMetaText}>Edited</AppText> : null}
    </View>
  );
}

export function ThreadFirstChatScreen({
  roomId,
  title = 'Chat',
  conversation,
  initialOpenSettings = false,
  onAddMembers,
  onBack,
  onLeftConversation
}: ThreadFirstChatScreenProps) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const setConversationMutedLocally = useMessagingStore((state) => state.setConversationMutedLocally);
  const [messages, setMessages] = useState<ThreadChatMessage[]>([]);
  const [participants, setParticipants] = useState<ThreadChatParticipant[]>([]);
  const [body, setBody] = useState('');
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ThreadChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ThreadChatMessage | null>(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(initialOpenSettings);
  const [settingsBusy, setSettingsBusy] = useState<'pin' | 'mute' | 'remove' | 'leave' | null>(null);
  const [pinned, setPinned] = useState(Boolean(conversation?.pinned));
  const [muted, setMuted] = useState(Boolean(conversation?.muted));
  const listRef = useRef<FlashListRef<ThreadChatMessage>>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadSentAtRef = useRef<string | null>(null);
  const olderLoadingRef = useRef(false);
  const lastOlderCursorRef = useRef<string | null>(null);
  const pendingScrollToBottomRef = useRef(false);

  const otherParticipants = useMemo(
    () => participants.filter((participant) => participant.userId !== currentUserId),
    [participants, currentUserId]
  );
  const newestOwnMessage = useMemo(
    () => messages.filter((message) => message.senderId === currentUserId).sort(newestFirst)[0],
    [messages, currentUserId]
  );
  const chronologicalMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );
  const typingLabel = typingUserIds.size > 0 ? 'User is typing...' : 'Active now';
  const participantRoles = useMemo<Record<string, ChatParticipantRole>>(
    () => conversation?.participantRoles ?? Object.fromEntries(
      participants.map((participant) => [participant.userId, participant.role])
    ),
    [conversation?.participantRoles, participants]
  );
  const currentUserRole = conversation?.currentUserRole
    ?? participants.find((participant) => participant.userId === currentUserId)?.role
    ?? 'member';
  const conversationMembers = conversation?.participants ?? [];

  useEffect(() => {
    if (initialOpenSettings) setSettingsOpen(true);
  }, [initialOpenSettings]);

  useEffect(() => {
    if (!conversation) return;
    setPinned(Boolean(conversation.pinned));
    setMuted(Boolean(conversation.muted));
    setConversationMutedLocally(roomId, Boolean(conversation.muted));
  }, [conversation, roomId, setConversationMutedLocally]);

  const patchParticipantReadAt = useCallback((userId: string, lastReadAt: string) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.userId === userId
          ? {
              ...participant,
              lastReadAt: isAtLeastReadThrough(lastReadAt, participant.lastReadAt)
                ? participant.lastReadAt
                : lastReadAt
            }
          : participant
      )
    );
  }, []);

  const broadcast = useCallback(async (event: string, payload: object) => {
    await channelRef.current?.send({
      type: 'broadcast',
      event,
      payload
    });
  }, []);

  const loadInitial = useCallback(async () => {
    if (!currentUserId) return;

    setInitialLoading(true);
    try {
      const [messagePage, participantRows] = await Promise.all([
        threadFirstChatService.listMessages(roomId),
        threadFirstChatService.listParticipants(roomId)
      ]);
      pendingScrollToBottomRef.current = true;
      setMessages(messagePage);
      setParticipants(participantRows);
      setHasMore(messagePage.length === threadFirstChatService.pageSize);
      olderLoadingRef.current = false;
      lastOlderCursorRef.current = null;
    } catch (error) {
      Alert.alert('Chat unavailable', error instanceof Error ? error.message : 'Could not load this chat.');
    } finally {
      setInitialLoading(false);
    }
  }, [currentUserId, roomId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (initialLoading || !pendingScrollToBottomRef.current) return;

    pendingScrollToBottomRef.current = false;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [initialLoading, messages.length]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: true },
        presence: { key: currentUserId }
      }
    });

    channel
      .on('broadcast', { event: 'message_created' }, ({ payload }) => {
        const { message } = payload as ChatMessageBroadcastPayload;
        if (!message || message.senderId === currentUserId) return;
        pendingScrollToBottomRef.current = true;
        setMessages((current) => mergeThreadMessages(current, { ...message, deliveryStatus: 'sent' }));
      })
      .on('broadcast', { event: 'message_retracted' }, ({ payload }) => {
        const { messageId } = payload as { messageId?: string };
        if (!messageId) return;
        setMessages((current) => removeThreadMessage(current, messageId));
      })
      .on('broadcast', { event: 'message_updated' }, ({ payload }) => {
        const { message } = payload as ChatMessageBroadcastPayload;
        if (!message || message.roomId !== roomId) return;
        setMessages((current) => mergeThreadMessages(current, message));
      })
      .on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
        const deletePayload = payload as ChatMessageDeletedBroadcastPayload;
        if (deletePayload.roomId !== roomId || !deletePayload.messageId) return;
        setMessages((current) => removeThreadMessage(current, deletePayload.messageId));
        setSelectedMessage((current) => current?.id === deletePayload.messageId ? null : current);
        setEditingMessage((current) => current?.id === deletePayload.messageId ? null : current);
      })
      .on('broadcast', { event: 'message_read' }, ({ payload }) => {
        const readPayload = payload as ChatReadBroadcastPayload;
        if (readPayload.roomId !== roomId || readPayload.userId === currentUserId) return;
        patchParticipantReadAt(readPayload.userId, readPayload.lastReadAt);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const typingPayload = payload as ChatTypingBroadcastPayload;
        if (typingPayload.roomId !== roomId || typingPayload.userId === currentUserId) return;
        setTypingUserIds((current) => {
          const next = new Set(current);
          if (typingPayload.isTyping) next.add(typingPayload.userId);
          else next.delete(typingPayload.userId);
          return next;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ userId: currentUserId, onlineAt: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      void channel.untrack();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId, patchParticipantReadAt, roomId]);

  const loadOlderMessages = useCallback(async () => {
    if (olderLoadingRef.current || !hasMore || !messages.length) return;

    const oldest = messages[messages.length - 1];
    const cursorKey = `${oldest.createdAt}:${oldest.id}`;
    if (lastOlderCursorRef.current === cursorKey) return;

    olderLoadingRef.current = true;
    lastOlderCursorRef.current = cursorKey;
    setOlderLoading(true);
    try {
      const page = await threadFirstChatService.listMessages(roomId, {
        createdAt: oldest.createdAt,
        id: oldest.id
      });
      setMessages((current) => mergeThreadMessages(current, page));
      setHasMore(page.length === threadFirstChatService.pageSize);
    } catch (error) {
      lastOlderCursorRef.current = null;
      Alert.alert('Could not load older messages', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      olderLoadingRef.current = false;
      setOlderLoading(false);
    }
  }, [hasMore, messages, roomId]);

  const markVisibleMessagesRead = useCallback(
    (viewableItems: ViewToken<ThreadChatMessage>[]) => {
      const newestVisibleIncoming = viewableItems
        .map((item) => item.item)
        .filter((message): message is ThreadChatMessage => Boolean(message && message.senderId !== currentUserId))
        .sort(newestFirst)[0];

      if (!newestVisibleIncoming) return;
      if (isAtLeastReadThrough(newestVisibleIncoming.createdAt, lastReadSentAtRef.current)) return;

      lastReadSentAtRef.current = newestVisibleIncoming.createdAt;
      patchParticipantReadAt(currentUserId, newestVisibleIncoming.createdAt);
      void broadcast('message_read', {
        roomId,
        userId: currentUserId,
        lastReadAt: newestVisibleIncoming.createdAt
      } satisfies ChatReadBroadcastPayload);
      void threadFirstChatService.markRead(roomId, newestVisibleIncoming.createdAt);
    },
    [broadcast, currentUserId, patchParticipantReadAt, roomId]
  );

  const sendTyping = (value: string) => {
    void broadcast('typing', {
      roomId,
      userId: currentUserId,
      isTyping: Boolean(value.trim())
    } satisfies ChatTypingBroadcastPayload);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        void broadcast('typing', { roomId, userId: currentUserId, isTyping: false } satisfies ChatTypingBroadcastPayload);
        typingTimeoutRef.current = null;
      }, 1600);
    }
  };

  const updateBody = (value: string) => {
    setBody(value);
    sendTyping(value);
  };

  const invalidateConversationData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(roomId) }),
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations })
    ]);
  }, [queryClient, roomId]);

  const patchConversationState = useCallback((patch: Partial<Conversation>) => {
    queryClient.setQueryData<Conversation | null>(messageKeys.conversation(roomId), (current) =>
      current ? { ...current, ...patch } : current
    );
    queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (current = []) =>
      current.map((item) => item.id === roomId ? { ...item, ...patch } : item)
    );
  }, [queryClient, roomId]);

  const cancelEditing = () => {
    setEditingMessage(null);
    setBody('');
    sendTyping('');
  };

  const saveEdit = async () => {
    const trimmed = body.trim();
    if (!editingMessage || !trimmed || messageActionLoading) return;
    if (trimmed === editingMessage.body) {
      cancelEditing();
      return;
    }

    setMessageActionLoading(true);
    try {
      const updated = await messageService.updateMessage(editingMessage.id, trimmed);
      setMessages((current) => mergeThreadMessages(current, updated));
      setEditingMessage(null);
      setBody('');
      sendTyping('');
      await broadcast('message_updated', { message: updated } satisfies ChatMessageBroadcastPayload);
      await invalidateConversationData();
    } catch (error) {
      Alert.alert('Edit failed', error instanceof Error ? error.message : 'Could not update your message.');
    } finally {
      setMessageActionLoading(false);
    }
  };

  const startEditingSelectedMessage = () => {
    if (!selectedMessage || selectedMessage.messageType !== 'text') return;
    setEditingMessage(selectedMessage);
    setBody(selectedMessage.body ?? '');
    setSelectedMessage(null);
  };

  const confirmDeleteSelectedMessage = () => {
    const message = selectedMessage;
    if (!message) return;
    setSelectedMessage(null);
    Alert.alert('Delete message?', 'This removes the message for everyone in the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setMessageActionLoading(true);
            try {
              await messageService.deleteMessage(message.id);
              setMessages((current) => removeThreadMessage(current, message.id));
              if (editingMessage?.id === message.id) cancelEditing();
              await broadcast('message_deleted', {
                roomId,
                messageId: message.id
              } satisfies ChatMessageDeletedBroadcastPayload);
              await invalidateConversationData();
            } catch (error) {
              Alert.alert('Delete failed', error instanceof Error ? error.message : 'Could not delete your message.');
            } finally {
              setMessageActionLoading(false);
            }
          })();
        }
      }
    ]);
  };

  const togglePinned = async () => {
    const next = !pinned;
    setSettingsBusy('pin');
    try {
      await messageService.setConversationPinned(roomId, next);
      setPinned(next);
      patchConversationState({ pinned: next });
      await invalidateConversationData();
    } catch (error) {
      Alert.alert('Pin failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSettingsBusy(null);
    }
  };

  const toggleMuted = async () => {
    const next = !muted;
    setSettingsBusy('mute');
    try {
      await messageService.setConversationMuted(roomId, next);
      setMuted(next);
      setConversationMutedLocally(roomId, next);
      patchConversationState({ muted: next });
      await invalidateConversationData();
    } catch (error) {
      Alert.alert('Mute failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSettingsBusy(null);
    }
  };

  const confirmRemoveMember = (member: UserProfile) => {
    Alert.alert('Remove member?', `${member.displayName} will no longer be able to access this conversation.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSettingsBusy('remove');
            try {
              await messageService.removeGroupMember(roomId, member.id);
              await Promise.all([loadInitial(), invalidateConversationData()]);
            } catch (error) {
              Alert.alert('Remove failed', error instanceof Error ? error.message : 'Please try again.');
            } finally {
              setSettingsBusy(null);
            }
          })();
        }
      }
    ]);
  };

  const confirmLeaveConversation = () => {
    Alert.alert('Leave conversation?', 'You will stop receiving messages and notifications from this chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSettingsBusy('leave');
            try {
              await messageService.leaveConversation(roomId);
              setConversationMutedLocally(roomId, false);
              queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (current = []) =>
                current.filter((item) => item.id !== roomId)
              );
              queryClient.removeQueries({ queryKey: messageKeys.conversation(roomId) });
              queryClient.removeQueries({ queryKey: messageKeys.messages(roomId) });
              setSettingsOpen(false);
              onLeftConversation?.();
            } catch (error) {
              Alert.alert('Could not leave', error instanceof Error ? error.message : 'Please try again.');
            } finally {
              setSettingsBusy(null);
            }
          })();
        }
      }
    ]);
  };

  const persistAfterBroadcast = async (message: ThreadChatMessage) => {
    try {
      const persisted = await threadFirstChatService.insertMessage(message);
      setMessages((current) => mergeThreadMessages(current, persisted));
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations });
    } catch (error) {
      setMessages((current) =>
        mergeThreadMessages(current, {
          ...message,
          deliveryStatus: 'failed'
        })
      );
      void broadcast('message_retracted', { roomId, messageId: message.id });
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const sendText = () => {
    const trimmed = body.trim();
    if (!trimmed || !currentUserId) return;

    const message: ThreadChatMessage = {
      id: threadFirstChatService.createMessageId(),
      roomId,
      senderId: currentUserId,
      messageType: 'text',
      body: trimmed,
      mediaUrl: null,
      mediaPath: null,
      mediaWidth: null,
      mediaHeight: null,
      mediaMimeType: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deliveryStatus: 'sending'
    };

    setBody('');
    sendTyping('');
    pendingScrollToBottomRef.current = true;
    setMessages((current) => mergeThreadMessages(current, message));
    void broadcast('message_created', { message } satisfies ChatMessageBroadcastPayload);
    void persistAfterBroadcast(message);
  };

  const sendMedia = async () => {
    if (!currentUserId || mediaLoading) return;

    try {
      setMediaLoading(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Photo library permission is required.');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.86,
        allowsEditing: false
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const messageId = threadFirstChatService.createMessageId();
      const media = await threadFirstChatService.uploadChatMedia(asset, roomId, currentUserId, messageId);
      const messageType = asset.type === 'video' ? 'video' : 'image';
      const message: ThreadChatMessage = {
        id: messageId,
        roomId,
        senderId: currentUserId,
        messageType,
        body: null,
        mediaUrl: media.mediaUrl,
        mediaPath: media.mediaPath,
        mediaWidth: media.mediaWidth,
        mediaHeight: media.mediaHeight,
        mediaMimeType: media.mediaMimeType,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deliveryStatus: 'sending'
      };

      pendingScrollToBottomRef.current = true;
      setMessages((current) => mergeThreadMessages(current, message));
      void broadcast('message_created', { message } satisfies ChatMessageBroadcastPayload);
      void persistAfterBroadcast(message);
    } catch (error) {
      Alert.alert('Attachment failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setMediaLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ThreadChatMessage }) => {
    const showSeen =
      item.id === newestOwnMessage?.id &&
      otherParticipants.length > 0 &&
      otherParticipants.every((participant) => isAtLeastReadThrough(item.createdAt, participant.lastReadAt));

    const canManage = item.senderId === currentUserId
      && item.deliveryStatus !== 'sending'
      && item.deliveryStatus !== 'failed';
    return (
      <MessageBubble
        message={item}
        currentUserId={currentUserId}
        showSeen={showSeen}
        onLongPress={canManage ? () => setSelectedMessage(item) : undefined}
      />
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {onBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} /> : null}
        <View style={styles.headerCopy}>
          <AppText style={styles.title} numberOfLines={1}>{title}</AppText>
          <AppText style={styles.subtitle} numberOfLines={1}>{typingLabel}</AppText>
        </View>
        <IconButton
          icon={MoreVertical}
          accessibilityLabel="Conversation settings"
          onPress={() => setSettingsOpen(true)}
        />
      </View>

      {initialLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.orange[500]} />
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={chronologicalMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          maintainVisibleContentPosition={{
            autoscrollToBottomThreshold: 0.2,
            animateAutoScrollToBottom: true
          }}
          onStartReached={() => void loadOlderMessages()}
          onStartReachedThreshold={0.25}
          ListHeaderComponent={olderLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.olderLoader} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ImageIcon size={24} color={colors.text.tertiary} />
              <AppText variant="bodyMuted" style={styles.emptyText}>Send the first message.</AppText>
            </View>
          }
          onViewableItemsChanged={({ viewableItems }) => markVisibleMessagesRead(viewableItems)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 72 }}
        />
      )}

      <View style={styles.composerContainer}>
        {editingMessage ? (
          <View style={styles.editBanner}>
            <View style={styles.editCopy}>
              <AppText style={styles.editTitle}>Editing message</AppText>
              <AppText variant="small" numberOfLines={1}>{editingMessage.body}</AppText>
            </View>
            <IconButton icon={X} size={32} iconSize={15} accessibilityLabel="Cancel editing" onPress={cancelEditing} />
          </View>
        ) : null}
        <View style={styles.composer}>
          <IconButton
            icon={Plus}
            accessibilityLabel="Attach photo or video"
            disabled={mediaLoading || Boolean(editingMessage)}
            onPress={() => void sendMedia()}
          />
          <TextInput
            value={body}
            onChangeText={updateBody}
            placeholder={editingMessage ? 'Edit message...' : 'Message...'}
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
            multiline
          />
          <IconButton
            icon={Send}
            filled
            accessibilityLabel={editingMessage ? 'Save edited message' : 'Send message'}
            disabled={!body.trim() || messageActionLoading}
            onPress={editingMessage ? () => void saveEdit() : sendText}
          />
        </View>
      </View>

      <BottomSheet open={Boolean(selectedMessage)} title="Message actions" onClose={() => setSelectedMessage(null)}>
        <View style={styles.messageActions}>
          {selectedMessage?.messageType === 'text' ? (
            <Button full variant="dark" icon={Edit3} onPress={startEditingSelectedMessage}>Edit message</Button>
          ) : null}
          <Button full variant="danger" icon={Trash2} onPress={confirmDeleteSelectedMessage}>Delete message</Button>
        </View>
      </BottomSheet>

      <ConversationSettingsSheet
        open={settingsOpen}
        title={title}
        isGroup={Boolean(conversation?.isGroup)}
        members={conversationMembers}
        participantRoles={participantRoles}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        pinned={pinned}
        muted={muted}
        busyAction={settingsBusy}
        onClose={() => setSettingsOpen(false)}
        onTogglePinned={() => void togglePinned()}
        onToggleMuted={() => void toggleMuted()}
        onAddMembers={() => {
          setSettingsOpen(false);
          onAddMembers?.();
        }}
        onRemoveMember={confirmRemoveMember}
        onLeave={confirmLeaveConversation}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  headerCopy: {
    flex: 1
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 15
  },
  subtitle: {
    color: colors.text.tertiary,
    fontSize: 11
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md
  },
  olderLoader: {
    paddingVertical: spacing.md
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  emptyText: {
    textAlign: 'center'
  },
  messageRow: {
    marginVertical: 4,
    alignItems: 'flex-start'
  },
  myMessageRow: {
    alignItems: 'flex-end'
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  myBubble: {
    backgroundColor: colors.orange[500],
    borderBottomRightRadius: 4
  },
  theirBubble: {
    backgroundColor: colors.dark[800],
    borderBottomLeftRadius: 4
  },
  mediaBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden'
  },
  messageText: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20
  },
  myMessageText: {
    color: colors.light[0]
  },
  media: {
    width: 198,
    height: 198,
    borderRadius: radii.lg,
    backgroundColor: colors.dark[700]
  },
  videoBubble: {
    width: 198,
    height: 198,
    borderRadius: radii.lg,
    backgroundColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  videoText: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md
  },
  viewerImage: {
    width: '100%',
    height: '100%'
  },
  messageMeta: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 3
  },
  messageMetaText: {
    color: colors.text.tertiary,
    fontSize: 10
  },
  seenText: {
    color: colors.semantic.success
  },
  bubblePressed: {
    opacity: 0.76
  },
  composerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark[700]
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm
  },
  editCopy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.orange[500]
  },
  editTitle: {
    color: colors.orange[400],
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: 10,
    paddingBottom: 30,
  },
  messageActions: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderRadius: 22,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 8,
    paddingBottom: 8,
    color: colors.text.primary,
    fontFamily: typography.bodyFamily,
    fontSize: 14
  }
});
