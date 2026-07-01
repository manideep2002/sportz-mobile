import { useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MoreVertical, Plus, Send } from 'lucide-react-native';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChatOptionsSheet } from '@/components/messages/ChatOptionsSheet';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { AppText, Avatar, BottomSheet, Button, IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { messageKeys, useConversation, useConversationMessages, useMarkConversationRead, useSendMessage } from '@/hooks/useMessages';
import { messageService } from '@/services/messageService';
import { storageService } from '@/services/storageService';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import type { Message } from '@/types/domain';
import { getOtherParticipant, getParticipantById } from '@/utils/conversation';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Chat'>;

export function ChatScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const conversationId = route.params.conversationId;
  const [body, setBody] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState<'media' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const textSendLockedRef = useRef(false);
  const targetUserId = route.params.targetUserId;
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [] } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  useRealtimeMessages(conversationId);
  useMarkConversationRead(conversationId);

  const otherParticipant = conversation
    ? targetUserId
      ? getParticipantById(conversation, targetUserId) ?? getOtherParticipant(conversation, currentUserId)
      : getOtherParticipant(conversation, currentUserId)
    : undefined;
  const recipientId =
    otherParticipant?.id ?? messages.find((message) => message.senderId !== currentUserId)?.senderId ?? '';
  const headerTitle = conversation?.isGroup ? conversation.title : otherParticipant?.displayName ?? conversation?.title ?? 'Chat';
  const headerInitials = conversation?.isGroup
    ? conversation.title.slice(0, 2).toUpperCase()
    : otherParticipant?.initials ?? '??';
  const showOnlineStatus = !conversation?.isGroup && Boolean(otherParticipant?.isOnline);
  const statusLabel = conversation?.isGroup ? `${conversation.participants.length} members` : showOnlineStatus ? 'Online' : 'Offline';

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (!editingId && (sendMessage.isPending || textSendLockedRef.current)) return;
    if (editingId) {
      const messageId = editingId;
      setEditingId(null);
      setBody('');
      void messageService.updateMessage(messageId, trimmed).then(() => {
        queryClient.setQueryData(messageKeys.messages(conversationId), (old: Message[] = []) =>
          old.map((message) => (message.id === messageId ? { ...message, body: trimmed } : message))
        );
      });
    } else {
      textSendLockedRef.current = true;
      setBody('');
      sendMessage.mutate(trimmed, {
        onSettled: () => {
          textSendLockedRef.current = false;
        }
      });
    }
  };

  const sendMedia = async () => {
    setAttachmentOpen(false);
    setAttachmentLoading('media');
    try {
      const picked = await storageService.pickMedia();
      if (!picked) return;
      const ownerId = currentUserId || 'chat';
      const url = await storageService.uploadMedia(picked, 'post-media', ownerId);
      await sendMessage.mutateAsync(`[media:${url}]`);
    } catch (error) {
      Alert.alert('Attachment failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAttachmentLoading(null);
    }
  };

  const openMessageActions = (message: Message) => {
    if (message.senderId !== currentUserId || message.body === '[deleted]') return;
    Alert.alert('Message options', undefined, [
      {
        text: 'Edit',
        onPress: () => {
          setEditingId(message.id);
          setBody(message.body);
        }
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await messageService.deleteMessage(message.id);
          queryClient.setQueryData(messageKeys.messages(conversationId), (old: Message[] = []) =>
            old.map((item) => (item.id === message.id ? { ...item, body: '[deleted]' } : item))
          );
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ], { cancelable: true });
  };

  const handleClearChat = () => {
    void (async () => {
      await messageService.clearConversation(conversationId);
      queryClient.setQueryData(messageKeys.messages(conversationId), []);
      await queryClient.invalidateQueries({ queryKey: messageKeys.conversations });
    })();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Avatar initials={headerInitials} uri={otherParticipant?.avatarUrl} size={40} online={showOnlineStatus} />
        <View style={{ flex: 1 }}>
          <AppText style={styles.title}>{headerTitle}</AppText>
          <AppText style={[styles.status, showOnlineStatus ? styles.online : null]}>{statusLabel}</AppText>
        </View>
        <IconButton icon={MoreVertical} accessibilityLabel="Chat options" onPress={() => setOptionsOpen(true)} />
      </View>
      <ChatOptionsSheet
        open={optionsOpen}
        conversationId={conversationId}
        isGroup={Boolean(conversation?.isGroup)}
        participantName={headerTitle}
        otherUserId={otherParticipant?.id}
        communityId={conversation?.communityId}
        onClose={() => setOptionsOpen(false)}
        onClearChat={handleClearChat}
      />
      <BottomSheet open={attachmentOpen} title="Attach" onClose={() => setAttachmentOpen(false)}>
        <View style={styles.attachmentSheet}>
          <Button full variant="dark" loading={attachmentLoading === 'media'} disabled={Boolean(attachmentLoading)} onPress={() => void sendMedia()}>Photo / Video</Button>
        </View>
      </BottomSheet>
      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        <View style={styles.today}>
          <AppText variant="small">Today</AppText>
        </View>
        {messages.map((message) => {
          const sender =
            message.senderId === currentUserId
              ? undefined
              : conversation
                ? getParticipantById(conversation, message.senderId) ?? otherParticipant
                : otherParticipant;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              recipientId={recipientId}
              sender={sender}
              onLongPress={() => openMessageActions(message)}
            />
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <IconButton icon={Plus} onPress={() => setAttachmentOpen(true)} accessibilityLabel="Attach photo or video" />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={editingId ? 'Edit message...' : 'Message...'}
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
        />
        <IconButton icon={Send} filled disabled={!body.trim() || (!editingId && sendMessage.isPending)} onPress={handleSend} />
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
  },
  attachmentSheet: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md
  }
});
