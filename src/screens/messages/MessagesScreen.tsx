import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, RefreshCw, Search } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTranslation } from '@/i18n';

import { ConversationRow } from '@/components/messages/ConversationRow';

import { AppRefreshControl, AppText, IconButton, Input, Screen, SectionHeader } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const { data: conversations = [], isLoading, isError, isRefetching, refetch } = useConversations();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
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

  return (
    <Screen
      withTabPadding
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.header}>
        <AppText variant="h2">
          {t('messages.title')}<AppText variant="h2" color={theme.accent}>.</AppText>
        </AppText>
        <View style={styles.headerActions}>
          {isRefetching ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <IconButton icon={RefreshCw} accessibilityLabel={t('messages.refresh')} onPress={() => void refetch()} />
          )}
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
              onPress={() => navigation.navigate('Chat', { conversationId: conversation.id })}
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
            onPress={() => navigation.navigate('Chat', { conversationId: conversation.id })}
            onMenuPress={() => navigation.navigate('Chat', { conversationId: conversation.id, openSettings: true })}
          />
        ))}
        {!isLoading && !isError && rest.length === 0 && pinned.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>{t('messages.empty')}</AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
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
