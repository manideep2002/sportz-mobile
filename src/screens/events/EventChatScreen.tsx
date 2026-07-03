import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Send } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Avatar, Button, IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { eventService } from '@/services/eventService';
import { useAuthStore } from '@/store/authStore';
import type { EventMessage } from '@/types/domain';
import { formatTime } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'EventChat'>;

const eventMessageKey = (eventId: string) => ['events', eventId, 'messages'] as const;

export function EventChatScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { eventId } = route.params;
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { data: messages = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: eventMessageKey(eventId),
    queryFn: () => eventService.listEventMessages(eventId)
  });

  useEffect(() => {
    const subscription = eventService.subscribeToEventMessages(eventId, (message) => {
      queryClient.setQueryData<EventMessage[]>(eventMessageKey(eventId), (old = []) =>
        old.some((item) => item.id === message.id) ? old : [...old, message]
      );
    });
    return () => subscription.unsubscribe();
  }, [eventId, queryClient]);

  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody('');
    setSending(true);
    try {
      const message = await eventService.sendEventMessage(eventId, trimmed);
      queryClient.setQueryData<EventMessage[]>(eventMessageKey(eventId), (old = []) => [...old, message]);
    } catch (error) {
      setBody(trimmed);
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Event Chat</AppText>
        <View style={{ width: 40 }} />
      </View>
      {isLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : null}
      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {isError ? (
          <View style={styles.state}>
            <AppText variant="bodyMuted" style={styles.stateText}>
              {error instanceof Error ? error.message : 'Could not load event chat.'}
            </AppText>
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          </View>
        ) : null}
        {!isLoading && !isError && messages.length === 0 ? (
          <View style={styles.state}>
            <AppText variant="bodyMuted" style={styles.stateText}>No event messages yet.</AppText>
          </View>
        ) : null}
        {messages.map((message) => {
          const mine = message.sender.id === currentUserId;
          return (
            <View key={message.id} style={[styles.messageRow, mine ? styles.mineRow : null]}>
              {!mine ? <Avatar initials={message.sender.initials} uri={message.sender.avatarUrl} size={32} /> : null}
              <View style={[styles.bubble, mine ? styles.mine : styles.them]}>
                {!mine ? <AppText style={styles.sender}>{message.sender.displayName}</AppText> : null}
                <AppText style={[styles.messageText, mine ? styles.mineText : null]}>{message.body}</AppText>
                <AppText style={[styles.time, mine ? styles.mineText : null]}>{formatTime(message.createdAt)}</AppText>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Message attendees..."
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
          onSubmitEditing={() => void send()}
        />
        <IconButton icon={Send} filled disabled={!body.trim() || sending || isError} onPress={() => void send()} />
      </View>
    </View>
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
    paddingVertical: spacing.md,
    gap: spacing.sm
  },
  messageRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen
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
  mineText: {
    color: colors.light[0]
  },
  time: {
    color: colors.text.tertiary,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end'
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
