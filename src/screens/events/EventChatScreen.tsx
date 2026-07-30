import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View
} from 'react-native';

import { AppRefreshControl, AppText, Avatar, Button, IconButton, VerifiedName } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import {
  eventService,
  mergeEventMessages,
  type EventMessageCursor
} from '@/services/eventService';
import { useAuthStore } from '@/store/authStore';
import type { EventMessage } from '@/types/domain';
import { formatTime } from '@/utils/format';
import { createUuid } from '@/utils/uuid';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'EventChat'>;

export function EventChatScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const { eventId } = route.params;
  const currentUserId = useAuthStore((state) => state.user?.id);
  const currentProfile = useAuthStore((state) => state.profile);
  const [body, setBody] = useState('');
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<EventMessageCursor | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const olderLoadingRef = useRef(false);

  const loadLatest = useCallback(async (mode: 'initial' | 'refresh' | 'reconnect') => {
    if (mode === 'initial') {
      setInitialLoading(true);
      setInitialError(null);
    } else if (mode === 'refresh') {
      setRefreshing(true);
    }

    try {
      const page = await eventService.listEventMessages(eventId);
      setMessages((current) => mergeEventMessages(current, page.messages));
      // Restart the older cursor from the new latest-page boundary. This may
      // re-read already loaded rows after reconnect, but ID merging is safe and
      // it cannot skip a burst larger than one page while the channel was down.
      setNextCursor(page.nextCursor);
      setInitialError(null);
    } catch (error) {
      if (mode === 'initial') {
        setInitialError(error instanceof Error ? error.message : 'Could not load event chat.');
      }
    } finally {
      if (mode === 'initial') setInitialLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    void loadLatest('initial');
  }, [eventId, loadLatest]);

  useEffect(() => {
    const subscription = eventService.subscribeToEventMessages(
      eventId,
      (message) => {
        setMessages((current) => mergeEventMessages(current, message));
      },
      (connected, reconnected) => {
        setRealtimeConnected(connected);
        if (connected && reconnected) void loadLatest('reconnect');
      }
    );
    return () => subscription.unsubscribe();
  }, [eventId, loadLatest]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || olderLoadingRef.current) return;
    olderLoadingRef.current = true;
    setOlderLoading(true);
    setOlderError(null);
    try {
      const page = await eventService.listEventMessages(eventId, nextCursor);
      setMessages((current) => mergeEventMessages(current, page.messages));
      setNextCursor(page.nextCursor);
    } catch (error) {
      setOlderError(error instanceof Error ? error.message : 'Could not load older messages.');
    } finally {
      olderLoadingRef.current = false;
      setOlderLoading(false);
    }
  }, [eventId, nextCursor]);

  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed || !currentUserId || !currentProfile || !realtimeConnected) return;

    const id = createUuid();
    const optimistic: EventMessage = {
      id,
      eventId,
      sender: currentProfile,
      body: trimmed,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sending'
    };
    setBody('');
    setMessages((current) => mergeEventMessages(current, optimistic));

    try {
      const message = await eventService.sendEventMessage(eventId, trimmed, id);
      setMessages((current) => mergeEventMessages(current, message));
    } catch (error) {
      setMessages((current) => current.map((message) =>
        message.id === id && message.deliveryStatus !== 'sent'
          ? { ...message, deliveryStatus: 'failed' }
          : message
      ));
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const renderMessage = ({ item: message }: { item: EventMessage }) => {
    const mine = message.sender.id === currentUserId;
    return (
      <View style={[styles.messageRow, mine ? styles.mineRow : null]}>
        {!mine ? (
          <Avatar
            initials={message.sender.initials}
            uri={message.sender.avatarUrl}
            size={32}
            accessibilityLabel={`View ${message.sender.displayName}'s profile`}
            onPress={() => navigation.navigate('UserProfile', { userId: message.sender.id })}
          />
        ) : null}
        <View
          style={[
            styles.bubble,
            mine
              ? [styles.mine, { backgroundColor: theme.accent }]
              : [styles.them, { backgroundColor: theme.surface }]
          ]}
        >
          {!mine ? (
            <VerifiedName
              profile={message.sender}
              style={styles.sender}
              numberOfLines={1}
              onPress={() => navigation.navigate('UserProfile', { userId: message.sender.id })}
            />
          ) : null}
          <AppText style={[styles.messageText, { color: mine ? theme.onAccent : theme.text }]}>
            {message.body}
          </AppText>
          <View style={styles.messageMeta}>
            {message.deliveryStatus === 'sending' ? (
              <AppText style={[styles.delivery, { color: theme.onAccent }]}>Sending…</AppText>
            ) : message.deliveryStatus === 'failed' ? (
              <AppText style={styles.failed}>Failed</AppText>
            ) : null}
            <AppText style={[styles.time, { color: mine ? theme.onAccent : theme.textSubtle }]}>
              {formatTime(message.createdAt)}
            </AppText>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Event Chat</AppText>
        <View style={{ width: 40 }} />
      </View>

      {!realtimeConnected && !initialLoading ? (
        <View style={[styles.connectionBanner, { backgroundColor: theme.surface }]}>
          <AppText variant="small">Reconnecting… Sending is paused.</AppText>
        </View>
      ) : null}

      {initialLoading ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} />
      ) : initialError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted" style={styles.stateText}>{initialError}</AppText>
          <Button size="sm" onPress={() => void loadLatest('initial')}>Retry</Button>
        </View>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.25}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadLatest('refresh')}
            />
          }
          ListEmptyComponent={
            <View style={styles.state}>
              <AppText variant="bodyMuted" style={styles.stateText}>No event messages yet.</AppText>
            </View>
          }
          ListFooterComponent={
            olderLoading ? (
              <ActivityIndicator color={theme.accent} style={styles.olderLoader} />
            ) : olderError ? (
              <View style={styles.paginationError}>
                <AppText variant="small">{olderError}</AppText>
                <Button size="sm" accessibilityLabel="Retry older event messages" onPress={() => void loadOlder()}>
                  Retry
                </Button>
              </View>
            ) : null
          }
        />
      )}

      <View style={[styles.composer, { borderTopColor: theme.border }]}>
        <TextInput
          accessibilityLabel="Message attendees"
          value={body}
          onChangeText={setBody}
          placeholder="Message attendees..."
          placeholderTextColor={theme.textSubtle}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          editable={!initialError}
          onSubmitEditing={() => void send()}
        />
        <IconButton
          icon={Send}
          filled
          accessibilityLabel="Send message to attendees"
          disabled={!body.trim() || !currentProfile || !realtimeConnected || Boolean(initialError)}
          onPress={() => void send()}
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
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  loader: {
    marginTop: spacing.xl
  },
  connectionBanner: {
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xs
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xl
  },
  stateText: {
    textAlign: 'center'
  },
  messages: {
    flexGrow: 1,
    paddingVertical: spacing.md
  },
  olderLoader: {
    marginVertical: spacing.md
  },
  paginationError: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md
  },
  messageRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xs
  },
  mineRow: {
    justifyContent: 'flex-end'
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: spacing.sm
  },
  mine: {
    backgroundColor: colors.orange[500]
  },
  them: {
    backgroundColor: colors.dark[800]
  },
  sender: {
    color: colors.orange[400],
    fontFamily: typography.bodyBold,
    fontSize: 12,
    marginBottom: 2
  },
  messageText: {
    color: colors.text.primary,
    fontSize: 13
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 4
  },
  delivery: {
    fontSize: 10,
    opacity: 0.8
  },
  failed: {
    color: colors.semantic.danger,
    fontSize: 10
  },
  time: {
    color: colors.text.tertiary,
    fontSize: 10
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark[700]
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 22,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    color: colors.text.primary,
    paddingHorizontal: spacing.md
  }
});
