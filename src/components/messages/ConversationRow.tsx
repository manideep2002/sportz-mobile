import { BellOff, MoreVertical, Pin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, VerifiedName } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { Conversation } from '@/types/domain';
import { getOtherParticipant } from '@/utils/conversation';
import { timeAgo } from '@/utils/format';

interface ConversationRowProps {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
  onMenuPress?: () => void;
}

export function ConversationRow({ conversation, currentUserId, onPress, onMenuPress }: ConversationRowProps) {
  const other = getOtherParticipant(conversation, currentUserId) ?? conversation.participants[0];
  const avatarInitials = conversation.isGroup ? conversation.title.slice(0, 2).toUpperCase() : other?.initials ?? '??';
  const title = conversation.isGroup ? conversation.title : other?.displayName ?? conversation.title;

  return (
    <Pressable onPress={onPress} onLongPress={onMenuPress} style={styles.row}>
      <Avatar
        initials={avatarInitials}
        uri={conversation.isGroup ? undefined : other?.avatarUrl}
        size={50}
        online={!conversation.isGroup && Boolean(other?.isOnline)}
      />
      <View style={styles.meta}>
        <View style={styles.titleRow}>
          {!conversation.isGroup && other ? (
            <VerifiedName profile={other} style={styles.title} containerStyle={styles.titleName} numberOfLines={1} />
          ) : (
            <AppText style={styles.title} numberOfLines={1}>{title}</AppText>
          )}
          <AppText variant="small">{timeAgo(conversation.lastMessageAt).replace(' ago', '')}</AppText>
        </View>
        <AppText variant="bodyMuted" numberOfLines={1}>
          {conversation.lastMessage}
        </AppText>
      </View>
      <View style={styles.trailing}>
        <View style={styles.indicators}>
          {conversation.pinned ? <Pin size={12} color={colors.orange[400]} fill={colors.orange[400]} /> : null}
          {conversation.muted ? <BellOff size={13} color={colors.text.tertiary} /> : null}
        </View>
        {conversation.unreadCount > 0 ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{conversation.unreadCount}</AppText>
          </View>
        ) : null}
        {onMenuPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${title}`}
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onMenuPress();
            }}
            style={styles.menuButton}
          >
            <MoreVertical size={17} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>
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
    fontSize: 15,
    flexShrink: 1
  },
  titleName: {
    flex: 1,
    marginRight: spacing.xs
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
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  indicators: {
    minHeight: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  menuButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
