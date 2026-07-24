import { Pressable, StyleSheet, View } from 'react-native';
import { Bell, Check, MessageSquare, UserPlus, Trophy, Heart, Reply, Calendar, X } from 'lucide-react-native';

import { AppText, Avatar, Button } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { SportzNotification } from '@/types/domain';
import { timeAgo } from '@/utils/format';

interface NotificationRowProps {
  notification: SportzNotification;
  onPress?: () => void;
  onCtaPress?: () => void;
  onInviteAccept?: () => void;
  onInviteDecline?: () => void;
  inviteActionLoading?: boolean;
}

const getNotificationIcon = (kind: SportzNotification['kind'], color: string) => {
  switch (kind) {
    case 'like':
      return <Heart size={20} color={color} />;
    case 'comment':
    case 'mention':
      return <Reply size={20} color={color} />;
    case 'follow':
    case 'follow_request':
      return <UserPlus size={20} color={color} />;
    case 'event':
      return <Calendar size={20} color={color} />;
    case 'message':
      return <MessageSquare size={20} color={color} />;
    case 'invite':
      return <UserPlus size={20} color={color} />;
    case 'achievement':
      return <Trophy size={20} color={color} />;
    default:
      return <Bell size={20} color={color} />;
  }
};

export function NotificationRow({
  notification,
  onPress,
  onCtaPress,
  onInviteAccept,
  onInviteDecline,
  inviteActionLoading = false
}: NotificationRowProps) {
  const { colors: theme } = useAppTheme();
  const showInviteActions = Boolean(onInviteAccept && onInviteDecline);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        !notification.read ? { backgroundColor: theme.accentSoft } : null
      ]}
    >
      {notification.actor ? (
        <Avatar initials={notification.actor.initials} uri={notification.actor.avatarUrl} size={44} />
      ) : (
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          {getNotificationIcon(notification.kind, theme.accent)}
        </View>
      )}
      <View style={styles.body}>
        <AppText style={styles.title}>{notification.title}</AppText>
        <AppText variant="bodyMuted">{notification.body}</AppText>
        <AppText variant="small" style={styles.time}>
          {timeAgo(notification.createdAt)}
        </AppText>
        {notification.ctaLabel ? (
          <Button size="sm" style={styles.cta} onPress={onCtaPress}>
            {notification.ctaLabel}
          </Button>
        ) : null}
        {showInviteActions ? (
          <View style={styles.inviteActions}>
            <Button
              size="sm"
              icon={Check}
              style={styles.inviteAction}
              loading={inviteActionLoading}
              onPress={(event) => {
                event.stopPropagation();
                onInviteAccept?.();
              }}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="dark"
              icon={X}
              style={styles.inviteAction}
              loading={inviteActionLoading}
              onPress={(event) => {
                event.stopPropagation();
                onInviteDecline?.();
              }}
            >
              Decline
            </Button>
          </View>
        ) : null}
      </View>
      {!notification.read ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  unread: {
    backgroundColor: 'rgba(255,90,31,0.04)'
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.overlays.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    flex: 1
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  time: {
    marginTop: 3
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 8
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 8
  },
  inviteAction: {
    flex: 1
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange[500],
    marginTop: 6
  }
});
