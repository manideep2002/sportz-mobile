import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { Conversation } from '@/types/domain';
import { getOtherParticipant } from '@/utils/conversation';
import { timeAgo } from '@/utils/format';

interface ConversationRowProps {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
}

export function ConversationRow({ conversation, currentUserId, onPress }: ConversationRowProps) {
  const other = getOtherParticipant(conversation, currentUserId) ?? conversation.participants[0];
  const avatarInitials = conversation.isGroup ? conversation.title.slice(0, 2).toUpperCase() : other?.initials ?? '??';

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Avatar initials={avatarInitials} size={50} online={!conversation.isGroup && Boolean(other?.isOnline)} />
      <View style={styles.meta}>
        <View style={styles.titleRow}>
          <AppText style={styles.title}>{conversation.title}</AppText>
          <AppText variant="small">{timeAgo(conversation.lastMessageAt).replace(' ago', '')}</AppText>
        </View>
        <AppText variant="bodyMuted" numberOfLines={1}>
          {conversation.lastMessage}
        </AppText>
      </View>
      {conversation.unreadCount > 0 ? (
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{conversation.unreadCount}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  meta: {
    flex: 1,
    overflow: 'hidden'
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline'
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 15
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 11
  }
});
