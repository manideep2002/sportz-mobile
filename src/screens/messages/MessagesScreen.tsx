import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Search } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useAppTranslation } from '@/i18n';

import { ConversationRow } from '@/components/messages/ConversationRow';

import { AdaptiveSplitView, AppRefreshControl, AppText, IconButton, Input, Screen, SectionHeader } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { useResponsiveLayout } from '@/layout/responsive';
import { ThreadFirstChatScreen } from '@/screens/messages/ThreadFirstChatScreen';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const responsive = useResponsiveLayout();
  const [query, setQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const { data: conversations = [], isLoading, isError, refetch } = useConversations();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');

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
  const openConversation = (conversationId: string) => {
    if (responsive.supportsSplitPane) {
      setSelectedConversationId(conversationId);
    } else {
      navigation.navigate('Chat', { conversationId });
    }
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
              onMenuPress={() => navigation.navigate('Chat', { conversationId: conversation.id, openSettings: true })}
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
            onMenuPress={() => navigation.navigate('Chat', { conversationId: conversation.id, openSettings: true })}
          />
        ))}
        {!isLoading && !isError && rest.length === 0 && pinned.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>{t('messages.empty')}</AppText>
        ) : null}
      </View>
    </View>
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
