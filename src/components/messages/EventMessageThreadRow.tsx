import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { EventMessageThread } from '@/types/domain';
import { timeAgo } from '@/utils/format';

interface EventMessageThreadRowProps {
  thread: EventMessageThread;
  onPress: () => void;
}

export function EventMessageThreadRow({ thread, onPress }: EventMessageThreadRowProps) {
  const { colors: theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${thread.unreadCount ? `${thread.unreadCount} unread. ` : ''}Open event chat for ${thread.title}`}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: theme.border }]}
    >
      <Avatar initials={thread.title.slice(0, 2).toUpperCase() || 'EV'} uri={thread.coverUrl} size={50} />
      <View style={styles.meta}>
        <View style={styles.titleRow}>
          <AppText style={[styles.title, { color: theme.text }]} numberOfLines={1}>{thread.title}</AppText>
          {thread.lastMessageAt ? <AppText variant="small">{timeAgo(thread.lastMessageAt, { addSuffix: false })}</AppText> : null}
        </View>
        <AppText variant="bodyMuted" numberOfLines={1}>
          {thread.lastMessage || 'No event messages yet.'}
        </AppText>
      </View>
      {thread.unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <AppText style={[styles.badgeText, { color: theme.onAccent }]}>{thread.unreadCount}</AppText>
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
  meta: { flex: 1, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.xs },
  title: { flex: 1, fontFamily: typography.bodyBold, fontSize: 15 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: { fontFamily: typography.bodyBold, fontSize: 11 }
});
