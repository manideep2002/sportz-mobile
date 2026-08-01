import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Card, ProgressBar, SportBadge } from '@/components/ui';
import { eventVisibilityLabel } from '@/constants/events';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { EventParticipationStatus, SportEvent } from '@/types/domain';
import { eventDate, formatTime } from '@/utils/format';

interface EventCardProps {
  event: SportEvent;
  participationStatus?: EventParticipationStatus;
  participationLoading?: boolean;
  participationError?: boolean;
  actionPending?: boolean;
  /** Pending specifically for a soft RSVP write (interested/declined). */
  rsvpPending?: boolean;
  onPress?: () => void;
  /** Called when the primary join / leave-waitlist button is pressed. */
  onParticipationAction?: () => void;
  /**
   * Called when the user taps one of the soft RSVP buttons.
   * Pass null to remove the current soft RSVP (goes back to none).
   */
  onRsvpAction?: (status: 'interested' | 'declined' | null) => void;
}

export function EventCard({
  event,
  participationStatus,
  participationLoading = false,
  participationError = false,
  actionPending = false,
  rsvpPending = false,
  onPress,
  onParticipationAction,
  onRsvpAction
}: EventCardProps) {
  const { colors: theme } = useAppTheme();
  const color = event.sport === 'Football' ? theme.success : theme.accent;
  const isFull = event.playerCount >= event.maxPlayers || event.status === 'full';
  const participationKnown = participationStatus !== undefined && !participationLoading && !participationError;
  // Users who are going or waitlisted cannot re-join; everyone else can attempt it.
  const canJoin = participationKnown && !['going', 'waitlisted'].includes(participationStatus) &&
    (event.status === 'open' || event.status === 'full');
  const canLeaveWaitlist = participationStatus === 'waitlisted';
  const isGoing = participationStatus === 'going';
  const isInterested = participationStatus === 'interested';
  const isDeclined = participationStatus === 'declined';

  // Show soft RSVP row when the user is not yet committed (going/waitlisted) and the
  // event is in a state where soft RSVPs make sense.
  const showSoftRsvp = participationKnown &&
    onRsvpAction != null &&
    !isGoing &&
    !canLeaveWaitlist &&
    !['cancelled', 'completed'].includes(event.status);

  const actionLabel = participationLoading
    ? 'Checking status…'
    : participationError || participationStatus === undefined
      ? 'Status unavailable'
      : isGoing
    ? 'Joined'
    : canLeaveWaitlist
      ? 'Leave Waitlist'
      : isInterested
        ? 'Interested'
        : isDeclined
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
                <SportBadge sport={event.sport} />
                <Badge tone="dark">{event.eventType}</Badge>
                {event.visibility !== 'public' ? (
                  <Badge tone="blue">{eventVisibilityLabel(event.visibility)}</Badge>
                ) : null}
              </View>
              <AppText style={[styles.title, { color: theme.text }]}>{event.title}</AppText>
              <AppText variant="small">{event.locationName}</AppText>
              <AppText variant="small">
                {eventDate(event.startsAt)} - {formatTime(event.startsAt)}
              </AppText>
            </View>
            <View style={styles.count}>
              <AppText style={[styles.playerCount, { color }]}>
                {event.playerCount}
                <AppText style={[styles.max, { color: theme.textSubtle }]}>/{event.maxPlayers}</AppText>
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
              variant={canLeaveWaitlist || isFull ? 'ghost' : isGoing ? 'dark' : participationStatus === 'none' || isInterested || isDeclined ? 'primary' : 'dark'}
              loading={actionPending}
              disabled={!participationKnown || actionPending || rsvpPending || (!canJoin && !canLeaveWaitlist)}
              onPress={(e) => {
                e.stopPropagation();
                onParticipationAction?.();
              }}
              style={styles.join}
            >
              {actionLabel}
            </Button>
          </View>

          {/* Soft RSVP row — visible for uncommitted states on active events */}
          {showSoftRsvp ? (
            <View style={styles.softRow}>
              <Button
                size="sm"
                variant={isInterested ? 'primary' : 'ghost'}
                loading={rsvpPending && !isInterested}
                disabled={rsvpPending}
                accessibilityLabel={isInterested ? 'Remove Interest' : 'Mark Interested'}
                accessibilityState={{ selected: isInterested }}
                style={styles.softBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onRsvpAction?.(isInterested ? null : 'interested');
                }}
              >
                {isInterested ? 'Interested ✓' : 'Interested'}
              </Button>
              <Button
                size="sm"
                variant={isDeclined ? 'dark' : 'ghost'}
                loading={rsvpPending && !isDeclined}
                disabled={rsvpPending}
                accessibilityLabel={isDeclined ? 'Remove Decline' : 'Not Going'}
                accessibilityState={{ selected: isDeclined }}
                style={styles.softBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onRsvpAction?.(isDeclined ? null : 'declined');
                }}
              >
                {isDeclined ? 'Not Going ✓' : 'Not Going'}
              </Button>
            </View>
          ) : null}
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
  },
  softRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  softBtn: {
    flex: 1,
    borderRadius: 10
  }
});
