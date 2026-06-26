import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ConversationRow } from '@/components/messages/ConversationRow';
import { AppText, IconButton, Input, Screen } from '@/components/ui';
import { spacing } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function NewMessageScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const { data: conversations = [] } = useConversations();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(normalizedQuery));
  }, [conversations, query]);

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">New Message</AppText>
        <View style={styles.headerSpacer} />
      </View>
      <Input
        icon={Search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search people and groups..."
        autoFocus
      />
      <View>
        {filteredConversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
            onPress={() => navigation.replace('Chat', { conversationId: conversation.id })}
          />
        ))}
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
  headerSpacer: {
    width: 40
  }
});
