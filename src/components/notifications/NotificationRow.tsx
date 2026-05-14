import { Pressable, StyleSheet, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { AppText, Avatar, Button } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { SportzNotification } from '@/types/domain';
import { timeAgo } from '@/utils/format';

interface NotificationRowProps {
  notification: SportzNotification;
  onPress?: () => void;
}

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !notification.read ? styles.unread : null]}>
      {notification.actor ? (
        <Avatar initials={notification.actor.initials} size={44} />
      ) : (
        <View style={styles.icon}>
          <Bell size={20} color={colors.orange[500]} />
        </View>
      )}
      <View style={styles.body}>
        <AppText style={styles.title}>{notification.title}</AppText>
        <AppText variant="bodyMuted">{notification.body}</AppText>
        <AppText variant="small" style={styles.time}>
          {timeAgo(notification.createdAt)}
        </AppText>
        {notification.ctaLabel ? (
          <Button size="sm" style={styles.cta}>
            {notification.ctaLabel}
          </Button>
        ) : null}
      </View>
      {!notification.read ? <View style={styles.dot} /> : null}
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange[500],
    marginTop: 6
  }
});
