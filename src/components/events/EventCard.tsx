import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Card, ProgressBar } from '@/components/ui';
import { eventVisibilityLabel } from '@/constants/events';
import { colors, spacing, typography } from '@/design/tokens';
import type { EventParticipationStatus, SportEvent } from '@/types/domain';
import { eventDate, formatTime } from '@/utils/format';

interface EventCardProps {
  event: SportEvent;
  participationStatus?: EventParticipationStatus;
  actionPending?: boolean;
  onPress?: () => void;
  onParticipationAction?: () => void;
}

export function EventCard({
  event,
  participationStatus = 'none',
  actionPending = false,
  onPress,
  onParticipationAction
}: EventCardProps) {
  const color = event.sport === 'Football' ? colors.semantic.success : colors.orange[500];
  const isFull = event.playerCount >= event.maxPlayers || event.status === 'full';
  const canJoin = participationStatus === 'none' && (event.status === 'open' || event.status === 'full');
  const canLeaveWaitlist = participationStatus === 'waitlisted';
  const actionLabel = participationStatus === 'going'
    ? 'Joined'
    : participationStatus === 'waitlisted'
      ? 'Leave Waitlist'
      : participationStatus === 'interested'
        ? 'Interested'
        : participationStatus === 'declined'
          ? 'Declined'
      : isFull
        ? 'Join Waitlist'
        : event.status === 'cancelled'
          ? 'Cancelled'
          : event.status === 'completed'
            ? 'Completed'
            : event.status === 'live'
              ? 'Live'
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
              <View style={styles.badges}>
                <Badge tone={event.sport === 'Football' ? 'green' : 'orange'}>{event.sport}</Badge>
                <Badge tone="dark">{event.eventType}</Badge>
                {event.visibility !== 'public' ? (
                  <Badge tone="blue">{eventVisibilityLabel(event.visibility)}</Badge>
                ) : null}
              </View>
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
            <Button
              size="sm"
              variant={canLeaveWaitlist || isFull ? 'ghost' : participationStatus === 'none' ? 'primary' : 'dark'}
              loading={actionPending}
              disabled={!canJoin && !canLeaveWaitlist}
              onPress={(event) => {
                event.stopPropagation();
                onParticipationAction?.();
              }}
              style={styles.join}
            >
              {actionLabel}
            </Button>
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
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
