import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import NetInfo from '@react-native-community/netinfo';
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
  Pause,
  Play,
  Plus,
  Send,
  Trash2,
  X
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { AppText, BottomSheet, Button, IconButton, VideoPlayer } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { messageKeys } from '@/hooks/useMessages';
import { supabase } from '@/lib/supabase';
import { messageService } from '@/services/messageService';
import { storageService } from '@/services/storageService';
import {
  mergeThreadMessages,
  removeThreadMessage,
  isMessageVisibleAfterClear,
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
import { getChatPresenceLabel } from '@/utils/chatPresence';
import { isStoryReactionMessage, isStoryReplyMessage, parseStoryReaction, parseStoryReply } from '@/utils/storyReaction';

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

export function MessageMedia({
  message,
  isActiveVideo,
  onActivateVideo
}: {
  message: ThreadChatMessage;
  isActiveVideo: boolean;
  onActivateVideo: (id: string | null) => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);
  const bubbleUrl = threadFirstChatService.getBubbleImageUrl(message.mediaPath, message.mediaUrl);
  const fullUrl = threadFirstChatService.getFullImageUrl(message.mediaPath, message.mediaUrl);

  useEffect(() => {
    let mounted = true;
    if (message.messageType !== 'video') return () => {
      mounted = false;
    };
    if (!message.mediaPath) {
      setSignedVideoUrl(message.mediaUrl);
      return () => {
        mounted = false;
      };
    }

    setSignedVideoUrl(null);
    setSignedUrlLoading(true);
    threadFirstChatService
      .getSignedVideoUrl(message.mediaPath)
      .then((url) => {
        if (mounted) setSignedVideoUrl(url);
      })
      .catch(() => {
        if (mounted) setSignedVideoUrl(message.mediaUrl);
      })
      .finally(() => {
        if (mounted) setSignedUrlLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [message.messageType, message.mediaPath, message.mediaUrl]);

  if (message.messageType === 'video') {
    const videoUri = signedVideoUrl ?? message.mediaUrl;
    const closeViewer = () => setViewerOpen(false);
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play video"
          style={styles.videoBubble}
          onPress={() => {
            onActivateVideo(null);
            setViewerOpen(true);
          }}
        >
          {signedUrlLoading ? (
            <ActivityIndicator color={colors.light[0]} />
          ) : (
            <VideoPlayer
              uri={videoUri}
              style={styles.videoBubble}
              autoPlay={isActiveVideo && !viewerOpen}
              paused={!isActiveVideo || viewerOpen}
              loop={false}
              interactive={false}
              onEnd={() => onActivateVideo(null)}
              testID={`chat-video-${message.id}`}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isActiveVideo ? 'Pause inline video' : 'Play inline video'}
            style={styles.videoPlaybackButton}
            onPress={(event) => {
              event.stopPropagation();
              onActivateVideo(isActiveVideo ? null : message.id);
            }}
          >
            {isActiveVideo ? (
              <Pause size={22} color={colors.light[0]} fill={colors.light[0]} />
            ) : (
              <Play size={22} color={colors.light[0]} fill={colors.light[0]} />
            )}
          </Pressable>
        </Pressable>
        <Modal
          visible={viewerOpen}
          transparent
          animationType="fade"
          onRequestClose={closeViewer}
          statusBarTranslucent
        >
          <View style={styles.viewer}>
            <VideoPlayer
              uri={videoUri}
              style={styles.viewerVideo}
              autoPlay
              loop={false}
              controls
              contentFit="contain"
              testID={`chat-video-fullscreen-${message.id}`}
            />
            <View style={styles.viewerClose}>
              <IconButton icon={X} accessibilityLabel="Close video" onPress={closeViewer} />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open photo" onPress={() => setViewerOpen(true)}>
        <ExpoImage
          testID={`chat-image-${message.id}`}
          source={{ uri: bubbleUrl ?? undefined }}
          style={styles.media}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      </Pressable>
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo viewer" accessibilityViewIsModal style={styles.viewer} onPress={() => setViewerOpen(false)}>
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

/**
 * Renders a story reaction message as a story-tile thumbnail with the emoji
 * centered on it, plus a short label below — matching the Instagram/WhatsApp
 * pattern so the recipient immediately understands context.
 *
 *  ┌──────────────┐
 *  │              │  ← story thumbnail (9:16 mini tile)
 *  │      🔥      │  ← emoji overlaid in center
 *  │              │
 *  └──────────────┘
 *   Reacted to your story
 */
function StoryReactionBubble({ body, mine }: { body: string | null; mine: boolean }) {
  const { colors: theme } = useAppTheme();
  const reaction = parseStoryReaction(body);

  if (!reaction) {
    // Fallback: render the raw body (shouldn't normally happen)
    return (
      <AppText style={[styles.messageText, { color: mine ? theme.onAccent : theme.text }]}>
        {body}
      </AppText>
    );
  }

  return (
    <View style={styles.storyReactionContainer}>
      {/* 9:16 story tile */}
      <View style={styles.storyReactionThumbnailWrap}>
        {reaction.storyMediaUrl ? (
          <ExpoImage
            source={{ uri: reaction.storyMediaUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityLabel="Story"
          />
        ) : (
          /* Placeholder gradient-like dark tile when there's no media */
          <View style={[StyleSheet.absoluteFill, styles.storyReactionPlaceholder]} />
        )}

        {/* Subtle dark vignette so the emoji is readable over any image */}
        <View style={styles.storyReactionVignette} />

        {/* Emoji badge — big, centered, with a frosted-glass pill behind it */}
        <View style={styles.storyReactionEmojiBadge}>
          <AppText style={styles.storyReactionEmojiText}>{reaction.emoji}</AppText>
        </View>
      </View>

      {/* Label underneath the tile */}
      <AppText
        style={[
          styles.storyReactionLabel,
          { color: mine ? theme.onAccent : theme.textSubtle }
        ]}
      >
        {mine ? 'You reacted to their story' : 'Reacted to your story'}
      </AppText>
    </View>
  );
}

/**
 * Renders a story text reply: same 9:16 thumbnail tile on top, with the
 * reply text in a pill below it — matching the WhatsApp quoted-story pattern.
 *
 *  ┌──────────────┐
 *  │              │  ← story thumbnail (9:16 mini tile)
 *  │  dim overlay │
 *  │              │
 *  └──────────────┘
 *  ┌──────────────────────────┐
 *  │  "Nice shot! 🏀"         │  ← reply text pill
 *  └──────────────────────────┘
 */
function StoryReplyBubble({ body, mine }: { body: string | null; mine: boolean }) {
  const { colors: theme } = useAppTheme();
  const reply = parseStoryReply(body);

  if (!reply) {
    return (
      <AppText style={[styles.messageText, { color: mine ? theme.onAccent : theme.text }]}>
        {body}
      </AppText>
    );
  }

  return (
    <View style={styles.storyReplyContainer}>
      {/* Story thumbnail tile — identical to reaction tile, bottom corners square
          so the text pill connects flush */}
      <View style={[styles.storyReactionThumbnailWrap, styles.storyReplyThumbnailWrap]}>
        {reply.storyMediaUrl ? (
          <ExpoImage
            source={{ uri: reply.storyMediaUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityLabel="Story"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.storyReactionPlaceholder]} />
        )}
        <View style={styles.storyReactionVignette} />
        {/* Small "story" label in the corner so context is clear */}
        <View style={styles.storyReplyCornerLabel}>
          <AppText style={styles.storyReplyCornerText}>Story</AppText>
        </View>
      </View>

      {/* Reply text pill */}
      <View
        style={[
          styles.storyReplyTextPill,
          { backgroundColor: mine ? theme.accent : theme.surface }
        ]}
      >
        <AppText style={[styles.messageText, { color: mine ? theme.onAccent : theme.text }]}>
          {reply.replyText}
        </AppText>
      </View>
    </View>
  );
}

// Helper: format date label for chat date separators
const formatDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  });
};

type ChatListItem = ThreadChatMessage | { type: 'dateSeparator'; label: string; id: string };

const isDateSeparator = (item: ChatListItem): item is { type: 'dateSeparator'; label: string; id: string } =>
  'type' in item && item.type === 'dateSeparator';

function MessageBubble({
  message,
  currentUserId,
  showSeen,
  isNewestOwn,
  showTime,
  activeVideoId,
  onActivateVideo,
  onPress,
  onLongPress,
  onRetry,
  onRemove,
  senderName,
  isGroup
}: {
  message: ThreadChatMessage;
  currentUserId: string;
  showSeen: boolean;
  isNewestOwn: boolean;
  showTime: boolean;
  activeVideoId: string | null;
  onActivateVideo: (id: string | null) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
  senderName?: string;
  isGroup?: boolean;
}) {
  const { colors: theme } = useAppTheme();
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
  const timeLabel = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <View style={[styles.messageRow, mine ? styles.myMessageRow : null]}>
      {isGroup && senderName ? (
        <AppText style={[styles.groupSenderName, { color: theme.textSubtle }]}>{senderName}</AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine && onLongPress ? 'Your message. Long press for actions.' : 'Message'}
        delayLongPress={320}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => (pressed ? styles.bubblePressed : null)}
      >
        <View
          style={[
            styles.bubble,
            mine ? styles.myBubble : styles.theirBubble,
            // Story reaction/reply bubbles have no background — the thumbnail fills the space
            message.messageType === 'text' && (isStoryReactionMessage(message.body) || isStoryReplyMessage(message.body))
              ? styles.storyReactionBubble
              : { backgroundColor: mine ? theme.accent : theme.surface },
            message.mediaUrl ? styles.mediaBubble : null
          ]}
        >
          {message.messageType === 'text' ? (
            isStoryReactionMessage(message.body) ? (
              <StoryReactionBubble body={message.body} mine={mine} />
            ) : isStoryReplyMessage(message.body) ? (
              <StoryReplyBubble body={message.body} mine={mine} />
            ) : (
              <AppText style={[styles.messageText, { color: mine ? theme.onAccent : theme.text }]}>{message.body}</AppText>
            )
          ) : (
            <MessageMedia
              message={message}
              isActiveVideo={activeVideoId === message.id}
              onActivateVideo={onActivateVideo}
            />
          )}
        </View>
      </Pressable>
      {showTime ? (
        <AppText style={[styles.messageTime, { color: theme.textSubtle }]}>{timeLabel}</AppText>
      ) : null}
      {mine && isNewestOwn ? (
        <View style={styles.messageMeta}>
          {message.deliveryStatus === 'sending' ? <Clock size={11} color={theme.textSubtle} /> : null}
          <AppText style={[styles.messageMetaText, { color: showSeen ? theme.success : theme.textSubtle }]}>{statusLabel}</AppText>
        </View>
      ) : mine && message.deliveryStatus === 'failed' ? (
        <View style={styles.messageMeta}>
          <AppText style={[styles.messageMetaText, { color: theme.danger }]}>Failed</AppText>
        </View>
      ) : !mine && message.editedAt ? (
        <AppText style={[styles.messageMetaText, { color: theme.textSubtle }]}>Edited</AppText>
      ) : null}
      {mine && message.deliveryStatus === 'failed' ? (
        <View style={styles.failedActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry message" onPress={onRetry}>
            <AppText style={[styles.failedActionText, { color: theme.accent }]}>Retry</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove failed message" onPress={onRemove}>
            <AppText style={[styles.failedActionText, { color: theme.danger }]}>Remove</AppText>
          </Pressable>
        </View>
      ) : null}
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
  const { colors: theme } = useAppTheme();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const setConversationMutedLocally = useMessagingStore((state) => state.setConversationMutedLocally);
  const [messages, setMessages] = useState<ThreadChatMessage[]>([]);
  const [participants, setParticipants] = useState<ThreadChatParticipant[]>([]);
  const savedDraft = useMessagingStore((state) => state.drafts?.[roomId] ?? '');
  const setDraft = useMessagingStore((state) => state.setDraft) ?? (() => undefined);
  const [body, setBody] = useState(savedDraft);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderLoadError, setOlderLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [presenceSynced, setPresenceSynced] = useState(false);
  const [onlinePeerUserIds, setOnlinePeerUserIds] = useState<Set<string>>(new Set());
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ThreadChatMessage | null>(null);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ThreadChatMessage | null>(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(initialOpenSettings);
  const [settingsBusy, setSettingsBusy] = useState<'pin' | 'mute' | 'clear' | 'remove' | 'leave' | null>(null);
  const [pinned, setPinned] = useState(Boolean(conversation?.pinned));
  const [muted, setMuted] = useState(Boolean(conversation?.muted));
  /** The message ID of the currently active (playing) video, or null. */
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const listRef = useRef<FlashListRef<ChatListItem> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadSentAtRef = useRef<string | null>(null);
  const olderLoadingRef = useRef(false);
  const lastOlderCursorRef = useRef<string | null>(null);
  const pendingScrollToBottomRef = useRef(false);
  const historyClearedAtRef = useRef<string | null>(null);
  const bodyRef = useRef(savedDraft);
  const deliveryInFlightIdsRef = useRef(new Set<string>());
  const hasSubscribedRef = useRef(false);
  const participantsRef = useRef<ThreadChatParticipant[]>([]);

  const senderNamesById = useMemo(() => {
    const map = new Map<string, string>();
    if (conversation?.participants) {
      for (const participant of conversation.participants) {
        map.set(participant.id, participant.displayName);
      }
    }
    return map;
  }, [conversation?.participants]);

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
  const listItems: ChatListItem[] = useMemo(() => {
    const result: ChatListItem[] = [];
    let lastLabel = '';
    for (const msg of chronologicalMessages) {
      const label = formatDateLabel(msg.createdAt);
      if (label !== lastLabel) {
        const separator: { type: 'dateSeparator'; label: string; id: string } = {
          type: 'dateSeparator',
          label,
          id: `sep:${label}`
        };
        result.push(separator);
        lastLabel = label;
      }
      result.push(msg);
    }
    return result;
  }, [chronologicalMessages]);
  const presenceLabel = getChatPresenceLabel({
    connected: realtimeConnected,
    synced: presenceSynced,
    isGroup: Boolean(conversation?.isGroup),
    typingCount: typingUserIds.size,
    onlinePeerCount: onlinePeerUserIds.size
  });
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
    participantsRef.current = participants;
  }, [participants]);

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
    if (!currentUserId) {
      setInitialLoading(false);
      setInitialError('Sign in again to load this conversation.');
      return;
    }

    setInitialLoading(true);
    setInitialError(null);
    // Do not briefly show the previous account's cached in-memory history
    // while the next participant watermark is loading.
    setMessages([]);
    setParticipants([]);
    setHasMore(false);
    historyClearedAtRef.current = null;
    try {
      const [messagePage, participantRows] = await Promise.all([
        threadFirstChatService.listMessages(roomId),
        threadFirstChatService.listParticipants(roomId)
      ]);
      const clearedAt = participantRows.find((participant) => participant.userId === currentUserId)?.clearedAt ?? null;
      historyClearedAtRef.current = clearedAt;
      pendingScrollToBottomRef.current = true;
      setMessages(messagePage.filter((message) => isMessageVisibleAfterClear(message.createdAt, clearedAt)));
      setParticipants(participantRows);
      setHasMore(messagePage.length === threadFirstChatService.pageSize);
      olderLoadingRef.current = false;
      lastOlderCursorRef.current = null;
    } catch (error) {
      setInitialError(error instanceof Error ? error.message : 'Could not load this chat.');
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

  const reconcileAfterReconnect = useCallback(async () => {
    try {
      const [messagePage, participantRows] = await Promise.all([
        threadFirstChatService.listMessages(roomId),
        threadFirstChatService.listParticipants(roomId)
      ]);
      const clearedAt = participantRows.find((participant) => participant.userId === currentUserId)?.clearedAt ?? null;
      historyClearedAtRef.current = clearedAt;
      setParticipants(participantRows);
      setMessages((current) => {
        const recoverable = current.filter((message) =>
          message.senderId === currentUserId &&
          (message.deliveryStatus === 'sending' || message.deliveryStatus === 'failed') &&
          isMessageVisibleAfterClear(message.createdAt, clearedAt)
        );
        return mergeThreadMessages(
          recoverable,
          messagePage
            .filter((message) => isMessageVisibleAfterClear(message.createdAt, clearedAt))
            .map((message) => ({ ...message, deliveryStatus: 'sent' as const }))
        );
      });
      setHasMore(messagePage.length === threadFirstChatService.pageSize);
      setInitialError(null);
    } catch {
      // Keep the durable loaded or failed-message state. The channel can retry
      // this reconciliation on its next successful subscription.
    }
  }, [currentUserId, roomId]);

  useEffect(() => {
    if (!currentUserId) return;
    hasSubscribedRef.current = false;

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: true },
        presence: { key: currentUserId }
      }
    });

    const syncPeerPresence = () => {
      const participantIds = new Set(
        participantsRef.current
          .map((participant) => participant.userId)
          .filter((userId) => userId !== currentUserId)
      );
      const state = channel.presenceState<Record<string, unknown>>();
      const onlineIds = new Set<string>();
      Object.entries(state).forEach(([key, presences]) => {
        const advertisedIds = [
          key,
          ...presences.map((presence) =>
            typeof presence.userId === 'string' ? presence.userId : null
          )
        ];
        advertisedIds.forEach((userId) => {
          if (userId && participantIds.has(userId)) onlineIds.add(userId);
        });
      });
      setOnlinePeerUserIds(onlineIds);
      setPresenceSynced(true);
    };

    channel
      .on('presence', { event: 'sync' }, syncPeerPresence)
      .on('broadcast', { event: 'message_created' }, ({ payload }) => {
        const { message } = payload as ChatMessageBroadcastPayload;
        if (!message || message.senderId === currentUserId) return;
        if (!isMessageVisibleAfterClear(message.createdAt, historyClearedAtRef.current)) return;
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
        if (!isMessageVisibleAfterClear(message.createdAt, historyClearedAtRef.current)) return;
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
          setRealtimeConnected(true);
          setPresenceSynced(false);
          if (AppState.currentState === 'active') {
            void channel.track({ userId: currentUserId, onlineAt: new Date().toISOString() });
          } else {
            void channel.untrack();
          }
          if (hasSubscribedRef.current) void reconcileAfterReconnect();
          hasSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeConnected(false);
          setPresenceSynced(false);
          setOnlinePeerUserIds(new Set());
        }
      });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setPresenceSynced(false);
        void channel
          .track({ userId: currentUserId, onlineAt: new Date().toISOString() })
          .then(syncPeerPresence);
      } else {
        setPresenceSynced(false);
        setOnlinePeerUserIds(new Set());
        void channel.untrack();
      }
    });

    channelRef.current = channel;

    return () => {
      appStateSubscription.remove();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      void channel.untrack();
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setRealtimeConnected(false);
      setPresenceSynced(false);
      setOnlinePeerUserIds(new Set());
    };
  }, [currentUserId, patchParticipantReadAt, reconcileAfterReconnect, roomId]);

  const loadOlderMessages = useCallback(async () => {
    if (olderLoadingRef.current || !hasMore || !messages.length) return;

    const oldest = messages[messages.length - 1];
    const cursorKey = `${oldest.createdAt}:${oldest.id}`;
    if (lastOlderCursorRef.current === cursorKey) return;

    olderLoadingRef.current = true;
    lastOlderCursorRef.current = cursorKey;
    setOlderLoading(true);
    setOlderLoadError(null);
    try {
      const page = await threadFirstChatService.listMessages(roomId, {
        createdAt: oldest.createdAt,
        id: oldest.id
      });
      setMessages((current) => mergeThreadMessages(
        current,
        page.filter((message) => isMessageVisibleAfterClear(message.createdAt, historyClearedAtRef.current))
      ));
      setHasMore(page.length === threadFirstChatService.pageSize);
    } catch (error) {
      lastOlderCursorRef.current = null;
      setOlderLoadError(error instanceof Error ? error.message : 'Could not load older messages.');
    } finally {
      olderLoadingRef.current = false;
      setOlderLoading(false);
    }
  }, [hasMore, messages, roomId]);

  const markVisibleMessagesRead = useCallback(
    (viewableItems: ViewToken<ChatListItem>[]) => {
      const newestVisibleIncoming = viewableItems
        .map((item) => item.item)
        .filter(
          (message): message is ThreadChatMessage =>
            Boolean(message && typeof message === 'object' && 'senderId' in message && message.senderId !== currentUserId)
        )
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
    bodyRef.current = value;
    setBody(value);
    setDraft(roomId, value);
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
    bodyRef.current = '';
    setDraft(roomId, '');
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
      bodyRef.current = '';
      setDraft(roomId, '');
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
    const editableBody = selectedMessage.body ?? '';
    setBody(editableBody);
    bodyRef.current = editableBody;
    setDraft(roomId, editableBody);
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

  const confirmClearHistory = () => {
    Alert.alert(
      'Clear history?',
      'This hides all existing messages only for you. Other participants will still see their history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear history',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSettingsBusy('clear');
              try {
                const participant = await threadFirstChatService.clearDirectRoomHistory(roomId);
                historyClearedAtRef.current = participant.clearedAt;
                setParticipants((current) => current.map((item) =>
                  item.userId === currentUserId ? participant : item
                ));
                setMessages([]);
                setHasMore(false);
                olderLoadingRef.current = false;
                lastOlderCursorRef.current = null;
                queryClient.removeQueries({ queryKey: messageKeys.messages(roomId) });
                patchConversationState({ lastMessage: '' });
                await invalidateConversationData();
              } catch (error) {
                Alert.alert('Could not clear history', error instanceof Error ? error.message : 'Please try again.');
              } finally {
                setSettingsBusy(null);
              }
            })();
          }
        }
      ]
    );
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
    if (deliveryInFlightIdsRef.current.has(message.id)) return;
    deliveryInFlightIdsRef.current.add(message.id);
    setMessages((current) => mergeThreadMessages(current, {
      ...message,
      deliveryStatus: 'sending'
    }));
    let persisted: ThreadChatMessage;
    try {
      const network = await NetInfo.fetch();
      if (!network.isConnected) throw new Error("You're offline. Reconnect and retry.");
      persisted = await threadFirstChatService.insertMessage(message);
    } catch {
      // Release the delivery lock before exposing Retry so an immediate tap is
      // accepted with the same idempotency key.
      deliveryInFlightIdsRef.current.delete(message.id);
      setMessages((current) =>
        mergeThreadMessages(current, {
          ...message,
          deliveryStatus: 'failed'
        })
      );
      void broadcast('message_retracted', { roomId, messageId: message.id });
      return;
    }

    const confirmed = { ...persisted, deliveryStatus: 'sent' as const };
    setMessages((current) => mergeThreadMessages(current, confirmed));
    deliveryInFlightIdsRef.current.delete(message.id);
    void broadcast('message_created', {
      message: confirmed
    } satisfies ChatMessageBroadcastPayload);
    void queryClient.invalidateQueries({ queryKey: messageKeys.conversations });
  };

  const sendText = () => {
    const trimmed = bodyRef.current.trim();
    if (!trimmed || !currentUserId || initialLoading || initialError) return;

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
    bodyRef.current = '';
    setDraft(roomId, '');
    sendTyping('');
    pendingScrollToBottomRef.current = true;
    setMessages((current) => mergeThreadMessages(current, message));
    void persistAfterBroadcast(message);
  };

  const retryFailedMessage = (message: ThreadChatMessage) => {
    if (message.deliveryStatus !== 'failed') return;
    pendingScrollToBottomRef.current = true;
    void persistAfterBroadcast(message);
  };

  const removeFailedMessage = (message: ThreadChatMessage) => {
    if (message.deliveryStatus !== 'failed' || deliveryInFlightIdsRef.current.has(message.id)) return;
    setMessages((current) => removeThreadMessage(current, message.id));
    void broadcast('message_retracted', { roomId, messageId: message.id });
  };

  const sendMedia = async () => {
    if (!currentUserId || mediaLoading || initialLoading || initialError) return;

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

      // Validate size (200 MB) and video duration (10 min) before uploading
      try {
        storageService.validateMediaAsset(asset, { maxSizeMb: 200, maxDurationSecs: 600 });
      } catch (validationError) {
        Alert.alert('Invalid media', validationError instanceof Error ? validationError.message : 'This file cannot be sent.');
        return;
      }

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
      void persistAfterBroadcast(message);
    } catch (error) {
      Alert.alert('Attachment failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setMediaLoading(false);
    }
  };

  const renderItem: ListRenderItem<ChatListItem> = ({ item }) => {
    // Date separator row
    if (isDateSeparator(item)) {
      return (
        <View style={styles.dateSeparator}>
          <View style={[styles.dateSeparatorLine, { backgroundColor: theme.border }]} />
          <AppText style={[styles.dateSeparatorLabel, { color: theme.textSubtle }]}>{item.label}</AppText>
          <View style={[styles.dateSeparatorLine, { backgroundColor: theme.border }]} />
        </View>
      );
    }
    // Regular message bubble
    const message = item as ThreadChatMessage;
    const showSeen =
      message.id === newestOwnMessage?.id &&
      otherParticipants.length > 0 &&
      otherParticipants.every((participant) => isAtLeastReadThrough(message.createdAt, participant.lastReadAt));
    const canManage = message.senderId === currentUserId
      && message.deliveryStatus !== 'sending'
      && message.deliveryStatus !== 'failed';
    return (
      <MessageBubble
        message={message}
        currentUserId={currentUserId}
        senderName={conversation?.isGroup ? (message.senderId === currentUserId ? 'You' : senderNamesById.get(message.senderId)) : undefined}
        isGroup={Boolean(conversation?.isGroup)}
        showSeen={showSeen}
        isNewestOwn={message.id === newestOwnMessage?.id}
        showTime={tappedMessageId === message.id}
        activeVideoId={activeVideoId}
        onActivateVideo={setActiveVideoId}
        onPress={() => setTappedMessageId((current) => current === message.id ? null : message.id)}
        onLongPress={canManage ? () => setSelectedMessage(message) : undefined}
        onRetry={message.deliveryStatus === 'failed' ? () => retryFailedMessage(message) : undefined}
        onRemove={message.deliveryStatus === 'failed' ? () => removeFailedMessage(message) : undefined}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        {onBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} /> : null}
        <View style={styles.headerCopy}>
          <AppText style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</AppText>
          <AppText style={[styles.subtitle, { color: theme.textSubtle }]} numberOfLines={1}>{presenceLabel}</AppText>
        </View>
        <IconButton
          icon={MoreVertical}
          accessibilityLabel="Conversation settings"
          onPress={() => setSettingsOpen(true)}
        />
      </View>

      {!realtimeConnected && !initialLoading ? (
        <View style={[styles.connectionBanner, { backgroundColor: theme.surface }]}>
          <AppText variant="small">Reconnecting… Reconnect to send or retry messages.</AppText>
        </View>
      ) : null}

      {initialLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : initialError ? (
        <View style={styles.loadErrorState}>
          <AppText variant="h4">Chat unavailable</AppText>
          <AppText variant="bodyMuted" style={styles.emptyText}>{initialError}</AppText>
          <Button accessibilityLabel="Retry chat" onPress={() => void loadInitial()}>Retry</Button>
        </View>
      ) : (
        <FlashList<ChatListItem>
          ref={listRef}
          data={listItems}
          getItemType={(item) => 'type' in item && item.type === 'dateSeparator' ? 'separator' : 'message'}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          maintainVisibleContentPosition={{
            autoscrollToBottomThreshold: 0.2,
            animateAutoScrollToBottom: true
          }}
          onStartReached={() => void loadOlderMessages()}
          onStartReachedThreshold={0.25}
          ListHeaderComponent={
            olderLoading ? (
              <ActivityIndicator color={theme.accent} style={styles.olderLoader} />
            ) : olderLoadError ? (
              <View style={styles.paginationError}>
                <AppText variant="small">{olderLoadError}</AppText>
                <Button size="sm" accessibilityLabel="Retry older messages" onPress={() => void loadOlderMessages()}>
                  Retry
                </Button>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ImageIcon size={24} color={theme.textSubtle} />
              <AppText variant="bodyMuted" style={styles.emptyText}>Send the first message.</AppText>
            </View>
          }
          onViewableItemsChanged={({ viewableItems }) => markVisibleMessagesRead(viewableItems)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 72 }}
        />
      )}

      <View style={[styles.composerContainer, { borderTopColor: theme.border }]}>
        {editingMessage ? (
          <View style={styles.editBanner}>
            <View style={styles.editCopy}>
              <AppText style={[styles.editTitle, { color: theme.accent }]}>Editing message</AppText>
              <AppText variant="small" numberOfLines={1}>{editingMessage.body}</AppText>
            </View>
            <IconButton icon={X} size={32} iconSize={15} accessibilityLabel="Cancel editing" onPress={cancelEditing} />
          </View>
        ) : null}
        <View style={styles.composer}>
          <IconButton
            icon={Plus}
            accessibilityLabel="Attach photo or video"
            disabled={mediaLoading || Boolean(editingMessage) || initialLoading || Boolean(initialError)}
            onPress={() => void sendMedia()}
          />
          <TextInput
            accessibilityLabel={editingMessage ? "Edit message" : "Message"}
            value={body}
            onChangeText={updateBody}
            placeholder={editingMessage ? 'Edit message...' : 'Message...'}
            placeholderTextColor={theme.textSubtle}
            selectionColor={theme.accent}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            multiline
            editable={!initialLoading && !initialError}
          />
          <IconButton
            icon={Send}
            filled
            accessibilityLabel={editingMessage ? 'Save edited message' : 'Send message'}
            disabled={!body.trim() || messageActionLoading || initialLoading || Boolean(initialError)}
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
        canClearHistory={conversation?.isGroup === false}
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
        onClearHistory={confirmClearHistory}
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
  loadErrorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl
  },
  connectionBanner: {
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xs
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md
  },
  olderLoader: {
    paddingVertical: spacing.md
  },
  paginationError: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm
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
    justifyContent: 'center'
  },
  videoPlaybackButton: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center'
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
  viewerVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 0
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: spacing.md,
    zIndex: 2
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
  failedActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: 3,
    paddingTop: spacing.xs
  },
  failedActionText: {
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  groupSenderName: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
    marginHorizontal: 4,
    fontFamily: typography.bodyBold
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
  },
  // Story reaction bubble
  storyReactionBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
    // Remove the normal bubble background — the thumbnail IS the background
    backgroundColor: 'transparent'
  },
  storyReactionContainer: {
    alignItems: 'center',
    gap: 6
  },
  storyReactionThumbnailWrap: {
    width: 144,
    height: 216,   // 9:16 ratio, same as the full-screen story viewer
    borderRadius: radii.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark[800]
  },
  storyReactionPlaceholder: {
    backgroundColor: colors.dark[700]
  },
  storyReactionVignette: {
    ...StyleSheet.absoluteFillObject,
    // Radial-style gradient achieved with a semi-transparent overlay.
    // Darkens edges just enough for the emoji to pop without hiding the image.
    backgroundColor: 'rgba(0,0,0,0.20)'
  },
  storyReactionEmojiBadge: {
    // Frosted-glass pill centered on the tile
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storyReactionEmojiText: {
    fontSize: 36,
    lineHeight: 44
  },
  storyReactionLabel: {
    fontSize: 11,
    fontFamily: typography.bodyFamily,
    color: colors.text.tertiary,
    textAlign: 'center'
  },
  // Story reply bubble
  storyReplyContainer: {
    alignItems: 'stretch',
    gap: 0   // tile and text pill touch — no gap, unified card feel
  },
  storyReplyTextPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    // top corners flush against the thumbnail bottom edge
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0
  },
  storyReplyCornerLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  storyReplyCornerText: {
    fontSize: 10,
    fontFamily: typography.bodyFamily,
    color: colors.light[0]
  },
  // Override: square bottom corners so the thumbnail and text pill join cleanly
  storyReplyThumbnailWrap: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.xs
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  dateSeparatorLabel: {
    fontSize: 11,
    fontFamily: typography.bodyFamily,
    textAlign: 'center',
    paddingHorizontal: 4
  },
  messageTime: {
    fontSize: 10,
    fontFamily: typography.bodyFamily,
    paddingHorizontal: 3,
    marginTop: 2
  }
});
