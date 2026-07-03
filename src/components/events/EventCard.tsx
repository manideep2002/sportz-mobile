import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Card, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { SportEvent } from '@/types/domain';
import { eventDate, formatTime } from '@/utils/format';

interface EventCardProps {
  event: SportEvent;
  joined?: boolean;
  waitlisted?: boolean;
  joining?: boolean;
  onPress?: () => void;
  onJoin?: () => void;
}

export function EventCard({ event, joined = false, waitlisted = false, joining = false, onPress, onJoin }: EventCardProps) {
  const color = event.sport === 'Football' ? colors.semantic.success : colors.orange[500];
  const isFull = event.playerCount >= event.maxPlayers;
  const canJoin = !joined && !waitlisted && (event.status === 'open' || event.status === 'full' || event.status === 'live');
  const actionLabel = joined
    ? 'Joined'
    : waitlisted
      ? 'Waitlisted'
      : isFull || event.status === 'full'
        ? 'Join Waitlist'
        : event.status === 'live'
          ? 'Join Now'
          : event.status === 'cancelled'
            ? 'Cancelled'
            : 'Join Event';
  return (
    <Pressable
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${event.sport} event at ${event.locationName}, ${event.playerCount} of ${event.maxPlayers} players`}
      accessibilityHint="Double tap to view event details"
    >
      <Card style={styles.card}>
        <View style={[styles.accent, { backgroundColor: color }]} />
        <View style={styles.content}>
          <View style={styles.top}>
            <View style={styles.meta}>
              <Badge tone={event.sport === 'Football' ? 'green' : 'orange'}>{event.sport}</Badge>
              <AppText style={styles.title}>{event.title}</AppText>
              <AppText variant="small">{event.locationName}</AppText>
              <AppText variant="small">
                {eventDate(event.startsAt)} - {formatTime(event.startsAt)}
              </AppText>
            </View>
            <View style={styles.count}>
              <AppText style={[styles.playerCount, { color }]}>
                {event.playerCount}
                <AppText style={styles.max}>/{event.maxPlayers}</AppText>
              </AppText>
              <AppText variant="small">players</AppText>
            </View>
          </View>
          <ProgressBar value={event.playerCount} max={event.maxPlayers} color={color} />
          <View style={styles.attendees}>
            <View style={styles.stack}>
              {event.attendees.slice(0, 4).map((user, index) => (
                <View key={user.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                  <Avatar initials={user.initials} uri={user.avatarUrl} size={30} tone={index % 2 === 0 ? 'orange' : 'green'} />
                </View>
              ))}
            </View>
            {joined || waitlisted ? (
              <Button size="sm" variant="dark" disabled style={styles.join}>
                {actionLabel}
              </Button>
            ) : (
              <Button
                size="sm"
                variant={event.status === 'live' || isFull || event.status === 'full' ? 'ghost' : 'primary'}
                loading={joining}
                disabled={!canJoin}
                onPress={(event) => {
                  event.stopPropagation();
                  onJoin?.();
                }}
                style={styles.join}
              >
                {actionLabel}
              </Button>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    padding: 0,
    position: 'relative'
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  content: {
    padding: 16,
    paddingLeft: 26,
    gap: spacing.sm
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  meta: {
    flex: 1,
    gap: 4
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 15
  },
  count: {
    alignItems: 'flex-end'
  },
  playerCount: {
    fontFamily: typography.headingBlack,
    fontSize: 26
  },
  max: {
    color: colors.text.tertiary,
    fontSize: 14
  },
  attendees: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  stack: {
    flexDirection: 'row',
    flex: 1
  },
  join: {
    borderRadius: 10
  }
});
