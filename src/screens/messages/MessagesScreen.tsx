import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ConversationRow } from '@/components/messages/ConversationRow';
import { AppText, IconButton, Input, Screen, SectionHeader } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const { data: conversations = [] } = useConversations();
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const pinned = conversations.filter((conversation) => conversation.pinned);
  const rest = conversations.filter((conversation) => !conversation.pinned);

  return (
    <Screen withTabPadding contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="h2">
          Messages<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <IconButton icon={Plus} onPress={() => navigation.navigate('NewMessage')} />
      </View>
      <Input icon={Search} placeholder="Search messages..." />
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
  section: {
    gap: spacing.xs
  },
  allLabel: {
    marginTop: 8
  }
});
