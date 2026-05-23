import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus, Send } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MessageBubble } from '@/components/messages/MessageBubble';
import { AppText, Avatar, IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { currentUser } from '@/data/mockData';
import { useConversation, useConversationMessages, useMarkConversationRead, useSendMessage } from '@/hooks/useMessages';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { getOtherParticipant, getParticipantById } from '@/utils/conversation';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Chat'>;

export function ChatScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const conversationId = route.params.conversationId;
  const [body, setBody] = useState('');
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [] } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  useRealtimeMessages(conversationId);
  useMarkConversationRead(conversationId);

  const otherParticipant = conversation ? getOtherParticipant(conversation, currentUser.id) : undefined;
  const recipientId =
    otherParticipant?.id ?? messages.find((message) => message.senderId !== currentUser.id)?.senderId ?? '';
  const headerTitle = conversation?.isGroup ? conversation.title : otherParticipant?.displayName ?? conversation?.title ?? 'Chat';
  const headerInitials = conversation?.isGroup
    ? conversation.title.slice(0, 2).toUpperCase()
    : otherParticipant?.initials ?? '??';
  const showOnlineStatus = !conversation?.isGroup && Boolean(otherParticipant?.isOnline);
  const statusLabel = conversation?.isGroup ? `${conversation.participants.length} members` : showOnlineStatus ? 'Online' : 'Offline';

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody('');
    sendMessage.mutate(trimmed);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Avatar initials={headerInitials} size={40} online={showOnlineStatus} />
        <View style={{ flex: 1 }}>
          <AppText style={styles.title}>{headerTitle}</AppText>
          <AppText style={[styles.status, showOnlineStatus ? styles.online : null]}>{statusLabel}</AppText>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        <View style={styles.today}>
          <AppText variant="small">Today</AppText>
        </View>
        {messages.map((message) => {
          const sender =
            message.senderId === currentUser.id
              ? undefined
              : conversation
                ? getParticipantById(conversation, message.senderId) ?? otherParticipant
                : otherParticipant;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUser.id}
              recipientId={recipientId}
              sender={sender}
            />
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <IconButton icon={Plus} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Message..."
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
        />
        <IconButton icon={Send} filled onPress={handleSend} />
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
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  status: {
    color: colors.text.tertiary,
    fontSize: 11
  },
  online: {
    color: colors.semantic.success
  },
  messages: {
    paddingVertical: 16,
    gap: spacing.sm
  },
  today: {
    alignSelf: 'center',
    backgroundColor: colors.dark[800],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 30,
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
    paddingHorizontal: 16,
    color: colors.text.primary,
    fontFamily: typography.bodyFamily
  }
});
