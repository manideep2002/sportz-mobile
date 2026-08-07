import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useAppTranslation } from '@/i18n';

import { ConversationRow } from '@/components/messages/ConversationRow';
import { ConversationSettingsSheet } from '@/components/messages/ConversationSettingsSheet';

import { AdaptiveSplitView, AppRefreshControl, AppText, IconButton, Input, Screen, SectionHeader } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { messageKeys, useConversations } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import { threadFirstChatService } from '@/services/threadFirstChatService';
import { useAuthStore } from '@/store/authStore';
import { useMessagingStore } from '@/store/messagingStore';
import { useResponsiveLayout } from '@/layout/responsive';
import { ThreadFirstChatScreen } from '@/screens/messages/ThreadFirstChatScreen';
import type { ChatParticipantRole, Conversation, UserProfile } from '@/types/domain';
import { getOtherParticipant } from '@/utils/conversation';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const responsive = useResponsiveLayout();
  const [query, setQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [settingsConversationId, setSettingsConversationId] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState<'pin' | 'mute' | 'clear' | 'remove' | 'leave' | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const { data: conversations = [], isLoading, isError, refetch } = useConversations();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const setConversationMutedLocally = useMessagingStore((state) => state.setConversationMutedLocally);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const handleRefresh = async () => {
    setManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setManualRefreshing(false);
    }
  };
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(normalized) ||
      conversation.lastMessage.toLowerCase().includes(normalized)
    );
  }, [conversations, query]);
  const pinned = filteredConversations.filter((conversation) => conversation.pinned);
  const rest = filteredConversations.filter((conversation) => !conversation.pinned);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId);
  const settingsConversation = conversations.find((conversation) => conversation.id === settingsConversationId) ?? null;

  const settingsTitle = settingsConversation?.isGroup
    ? settingsConversation.title
    : (settingsConversation ? getOtherParticipant(settingsConversation, currentUserId)?.displayName : undefined) ??
      settingsConversation?.title ??
      'Chat';
  const settingsMembers = settingsConversation?.participants ?? [];
  const settingsParticipantRoles = useMemo<Record<string, ChatParticipantRole>>(() => {
    if (!settingsConversation) return {};
    return (
      settingsConversation.participantRoles ??
      Object.fromEntries(
        settingsConversation.participants.map((participant) => [participant.id, 'member' as ChatParticipantRole])
      )
    );
  }, [settingsConversation]);
  const settingsCurrentUserRole: ChatParticipantRole = settingsConversation?.currentUserRole ?? 'member';

  const openConversation = (conversationId: string) => {
    if (responsive.supportsSplitPane) {
      setSelectedConversationId(conversationId);
    } else {
      navigation.navigate('Chat', { conversationId });
    }
  };

  const togglePinned = async () => {
    if (!settingsConversation) return;
    const roomId = settingsConversation.id;
    const next = !settingsConversation.pinned;
    setSettingsBusy('pin');
    try {
      await messageService.setConversationPinned(roomId, next);
      queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (current = []) =>
        current.map((item) => (item.id === roomId ? { ...item, pinned: next } : item))
      );
      queryClient.setQueryData<Conversation | null>(messageKeys.conversation(roomId), (current) =>
        current ? { ...current, pinned: next } : current
      );
      await refetch();
    } catch (error) {
      Alert.alert('Pin failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSettingsBusy(null);
    }
  };

  const toggleMuted = async () => {
    if (!settingsConversation) return;
    const roomId = settingsConversation.id;
    const next = !settingsConversation.muted;
    setSettingsBusy('mute');
    try {
      await messageService.setConversationMuted(roomId, next);
      setConversationMutedLocally(roomId, next);
      queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (current = []) =>
        current.map((item) => (item.id === roomId ? { ...item, muted: next } : item))
      );
      queryClient.setQueryData<Conversation | null>(messageKeys.conversation(roomId), (current) =>
        current ? { ...current, muted: next } : current
      );
      await refetch();
    } catch (error) {
      Alert.alert('Mute failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSettingsBusy(null);
    }
  };

  const confirmClearHistory = () => {
    if (!settingsConversation) return;
    const roomId = settingsConversation.id;
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
                await threadFirstChatService.clearDirectRoomHistory(roomId);
                queryClient.removeQueries({ queryKey: messageKeys.messages(roomId) });
                queryClient.setQueryData<Conversation[]>(messageKeys.conversations, (current = []) =>
                  current.map((item) => (item.id === roomId ? { ...item, lastMessage: '' } : item))
                );
                queryClient.setQueryData<Conversation | null>(messageKeys.conversation(roomId), (current) =>
                  current ? { ...current, lastMessage: '' } : current
                );
                await refetch();
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

  const handleAddMembers = () => {
    if (!settingsConversation) return;
    const roomId = settingsConversation.id;
    setSettingsConversationId(null);
    navigation.navigate('NewMessage', { addToConversationId: roomId });
  };

  const confirmRemoveMember = (member: UserProfile) => {
    if (!settingsConversation) return;
    const roomId = settingsConversation.id;
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
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: messageKeys.conversation(roomId) }),
                queryClient.invalidateQueries({ queryKey: messageKeys.conversations }),
                refetch()
              ]);
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
    if (!settingsConversation) return;
    const roomId = settingsConversation.id;
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
              setSettingsConversationId(null);
              if (selectedConversationId === roomId) {
                setSelectedConversationId(null);
              }
              await refetch();
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

  const conversationList = (
    <View style={styles.content}>
      <View style={styles.header}>
        <AppText variant="h2">
          {t('messages.title')}<AppText variant="h2" color={theme.accent}>.</AppText>
        </AppText>
        <View style={styles.headerActions}>
          <IconButton icon={Plus} accessibilityLabel={t('messages.newMessage')} onPress={() => navigation.navigate('NewMessage')} />
        </View>
      </View>
      <Input icon={Search} value={query} onChangeText={setQuery} placeholder={t('messages.search')} />
      {isLoading ? <ActivityIndicator color={theme.accent} /> : null}
      {isError ? <AppText variant="bodyMuted">{t('messages.loadError')}</AppText> : null}
      {pinned.length ? (
        <View style={styles.section}>
          <SectionHeader title={t('messages.pinned')} />
          {pinned.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              currentUserId={currentUserId}
              onPress={() => openConversation(conversation.id)}
              onMenuPress={() => setSettingsConversationId(conversation.id)}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.section}>
        <AppText variant="caption" style={styles.allLabel}>{t('messages.all')}</AppText>
        {rest.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
            onPress={() => openConversation(conversation.id)}
            onMenuPress={() => setSettingsConversationId(conversation.id)}
          />
        ))}
        {!isLoading && !isError && rest.length === 0 && pinned.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>{t('messages.empty')}</AppText>
        ) : null}
      </View>
    </View>
  );

  const settingsSheet = (
    <ConversationSettingsSheet
      open={Boolean(settingsConversation)}
      title={settingsTitle}
      isGroup={Boolean(settingsConversation?.isGroup)}
      canClearHistory={settingsConversation?.isGroup === false}
      members={settingsMembers}
      participantRoles={settingsParticipantRoles}
      currentUserId={currentUserId}
      currentUserRole={settingsCurrentUserRole}
      pinned={Boolean(settingsConversation?.pinned)}
      muted={Boolean(settingsConversation?.muted)}
      busyAction={settingsBusy}
      onClose={() => setSettingsConversationId(null)}
      onTogglePinned={() => void togglePinned()}
      onToggleMuted={() => void toggleMuted()}
      onClearHistory={confirmClearHistory}
      onAddMembers={handleAddMembers}
      onRemoveMember={confirmRemoveMember}
      onLeave={confirmLeaveConversation}
    />
  );

  if (responsive.supportsSplitPane) {
    return (
      <Screen scroll={false} withTabPadding maxWidth="wide" contentContainerStyle={styles.splitScreen}>
        <AdaptiveSplitView
          primary={
            <ScrollView
              accessibilityLabel="Conversations"
              keyboardShouldPersistTaps="handled"
              refreshControl={<AppRefreshControl refreshing={manualRefreshing} onRefresh={() => void handleRefresh()} />}
              contentContainerStyle={styles.listPane}
            >
              {conversationList}
            </ScrollView>
          }
          secondary={
            selectedConversation ? (
              <ThreadFirstChatScreen
                key={selectedConversation.id}
                roomId={selectedConversation.id}
                title={selectedConversation.title}
                conversation={selectedConversation}
                onAddMembers={() => navigation.navigate('NewMessage', { addToConversationId: selectedConversation.id })}
                onBack={() => setSelectedConversationId(null)}
                onLeftConversation={() => setSelectedConversationId(null)}
              />
            ) : (
              <View style={[styles.threadPlaceholder, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <AppText variant="h3">{t('messages.title')}</AppText>
                <AppText variant="bodyMuted">Choose a conversation to open it beside the list.</AppText>
              </View>
            )
          }
          primaryStyle={[styles.listColumn, { borderColor: theme.border }]}
        />
        {settingsSheet}
      </Screen>
    );
  }

  return (
    <Screen
      withTabPadding
      maxWidth="content"
      refreshControl={
        <AppRefreshControl
          refreshing={manualRefreshing}
          onRefresh={() => void handleRefresh()}
        />
      }
    >
      {conversationList}
      {settingsSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  splitScreen: {
    paddingBottom: 88
  },
  listPane: {
    paddingRight: spacing.md
  },
  listColumn: {
    borderRightWidth: StyleSheet.hairlineWidth
  },
  threadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: spacing.xl
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  section: {
    gap: spacing.xs
  },
  allLabel: {
    marginTop: 8
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl
  }
});
