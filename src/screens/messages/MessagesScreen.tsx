import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, RefreshCw, Search } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ConversationRow } from '@/components/messages/ConversationRow';

import { AppRefreshControl, AppText, IconButton, Input, Screen, SectionHeader } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const { data: conversations = [], isLoading, isError, isRefetching, refetch } = useConversations();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
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
          Messages<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <View style={styles.headerActions}>
          {isRefetching ? (
            <ActivityIndicator color={colors.orange[500]} />
          ) : (
            <IconButton icon={RefreshCw} accessibilityLabel="Refresh messages" onPress={() => void refetch()} />
          )}
          <IconButton icon={Plus} accessibilityLabel="New message" onPress={() => navigation.navigate('NewMessage')} />
        </View>
      </View>
      <Input icon={Search} value={query} onChangeText={setQuery} placeholder="Search messages..." />
      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {isError ? <AppText variant="bodyMuted">Could not load messages. Pull down to retry.</AppText> : null}
      {pinned.length ? (
        <View style={styles.section}>
          <SectionHeader title="Pinned" />
          {pinned.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              currentUserId={currentUserId}
              onPress={() => navigation.navigate('Chat', { conversationId: conversation.id })}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.section}>
        <AppText variant="caption" style={styles.allLabel}>All Messages</AppText>
        {rest.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
            onPress={() => navigation.navigate('Chat', { conversationId: conversation.id })}
          />
        ))}
        {!isLoading && !isError && rest.length === 0 && pinned.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>No messages yet.</AppText>
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
