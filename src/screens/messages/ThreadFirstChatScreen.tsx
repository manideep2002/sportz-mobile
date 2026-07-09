import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Clock, Image as ImageIcon, Plus, Send, Video } from 'lucide-react-native';
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

import { AppText, IconButton } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { messageKeys } from '@/hooks/useMessages';
import { supabase } from '@/lib/supabase';
import {
  mergeThreadMessages,
  removeThreadMessage,
  threadFirstChatService
} from '@/services/threadFirstChatService';
import { useAuthStore } from '@/store/authStore';
import type {
  ChatMessageBroadcastPayload,
  ChatReadBroadcastPayload,
  ChatTypingBroadcastPayload,
  ThreadChatMessage,
  ThreadChatParticipant
} from '@/types/threadFirstChat';

interface ThreadFirstChatScreenProps {
  roomId: string;
  title?: string;
  onBack?: () => void;
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
  showSeen
}: {
  message: ThreadChatMessage;
  currentUserId: string;
  showSeen: boolean;
}) {
  const mine = message.senderId === currentUserId;
  const statusLabel =
    message.deliveryStatus === 'sending'
      ? 'Sending'
      : message.deliveryStatus === 'failed'
        ? 'Failed'
        : showSeen
          ? 'Seen'
          : 'Sent';

  return (
    <View style={[styles.messageRow, mine ? styles.myMessageRow : null]}>
      <View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble, message.mediaUrl ? styles.mediaBubble : null]}>
        {message.messageType === 'text' ? (
          <AppText style={[styles.messageText, mine ? styles.myMessageText : null]}>{message.body}</AppText>
        ) : (
          <MessageMedia message={message} />
        )}
      </View>
      {mine ? (
        <View style={styles.messageMeta}>
          {message.deliveryStatus === 'sending' ? <Clock size={11} color={colors.text.tertiary} /> : null}
          <AppText style={[styles.messageMetaText, showSeen ? styles.seenText : null]}>{statusLabel}</AppText>
        </View>
      ) : null}
    </View>
  );
}

export function ThreadFirstChatScreen({ roomId, title = 'Chat', onBack }: ThreadFirstChatScreenProps) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const [messages, setMessages] = useState<ThreadChatMessage[]>([]);
  const [participants, setParticipants] = useState<ThreadChatParticipant[]>([]);
  const [body, setBody] = useState('');
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
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

    return <MessageBubble message={item} currentUserId={currentUserId} showSeen={showSeen} />;
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {onBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} /> : null}
        <View style={styles.headerCopy}>
          <AppText style={styles.title} numberOfLines={1}>{title}</AppText>
          <AppText style={styles.subtitle} numberOfLines={1}>{typingLabel}</AppText>
        </View>
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

      <View style={styles.composer}>
        <IconButton
          icon={Plus}
          accessibilityLabel="Attach photo or video"
          disabled={mediaLoading}
          onPress={() => void sendMedia()}
        />
        <TextInput
          value={body}
          onChangeText={updateBody}
          placeholder="Message..."
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
          multiline
        />
        <IconButton
          icon={Send}
          filled
          accessibilityLabel="Send message"
          disabled={!body.trim()}
          onPress={sendText}
        />
      </View>
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
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark[700]
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
