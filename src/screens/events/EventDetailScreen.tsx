import { useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, Clock, Flag, MapPin, Share2, MessageCircle, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';


import { AppRefreshControl, AppText, Avatar, Badge, Button, Card, IconButton, ProgressBar, Screen, VerifiedName } from '@/components/ui';

import { eventPaymentNotice, eventVisibilityLabel } from '@/constants/events';
import { CourtArt } from '@/components/feed/CourtArt';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import {
  useEvent,
  useEventParticipation,
  useJoinEvent,
  useLeaveEvent,
  useLeaveEventWaitlist,
  useMyEventInvitation,
  useRespondEventInvitation,
  useRsvpEvent
} from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import type { EventParticipationStatus, SportEvent } from '@/types/domain';
import { eventDate, formatTime } from '@/utils/format';
import { mediaVariants } from '@/utils/mediaOptimization';
import { shareEvent } from '@/utils/share';
import { useAuthStore } from '@/store/authStore';
import { useResponsiveLayout } from '@/layout/responsive';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'EventDetail'>;

// ── RSVP control ──────────────────────────────────────────────────────────────

interface RsvpControlProps {
  event: SportEvent;
  participationStatus?: EventParticipationStatus;
  participationLoading: boolean;
  participationError: boolean;
  isOrganizer: boolean;
  invitation: { id: string; status: string } | null | undefined;
  joinEvent: ReturnType<typeof useJoinEvent>;
  leaveEvent: ReturnType<typeof useLeaveEvent>;
  leaveWaitlist: ReturnType<typeof useLeaveEventWaitlist>;
  rsvpEvent: ReturnType<typeof useRsvpEvent>;
  respondInvitation: ReturnType<typeof useRespondEventInvitation>;
  onJoin: () => Promise<void>;
  onLeave: () => void;
  onLeaveWaitlist: () => void;
  onRespondToInvitation: (accept: boolean) => Promise<void>;
  onRsvp: (status: 'interested' | 'declined') => Promise<void>;
  onRetryParticipation: () => void;
  onNavigateToChat: () => void;
  onNavigateToManage: () => void;
}

/**
 * Renders the appropriate set of CTA buttons for every RSVP state.
 *
 * State rules:
 * - going → Leave Event + Event Chat (no RSVP buttons: must leave first)
 * - waitlisted → Leave Waitlist only
 * - interested/declined → Join + soft RSVP toggle row
 * - none → Join + soft RSVP row
 * - organizer → Manage + Event Chat (if going)
 * - pending invite → Accept + Decline (overrides all above for non-organizers)
 */
function RsvpControl({
  event,
  participationStatus,
  participationLoading,
  participationError,
  isOrganizer,
  invitation,
  joinEvent,
  leaveEvent,
  leaveWaitlist,
  rsvpEvent,
  respondInvitation,
  onJoin,
  onLeave,
  onLeaveWaitlist,
  onRespondToInvitation,
  onRsvp,
  onRetryParticipation,
  onNavigateToChat,
  onNavigateToManage
}: RsvpControlProps) {
  const isFull = event.playerCount >= event.maxPlayers || event.status === 'full';
  const isCancelled = event.status === 'cancelled';
  const isGoing = participationStatus === 'going';
  const isWaitlisted = participationStatus === 'waitlisted';
  const isInterested = participationStatus === 'interested';
  const isDeclined = participationStatus === 'declined';
  const canJoin = !isCancelled && !isGoing && !isWaitlisted &&
    (event.status === 'open' || event.status === 'full');

  if (isOrganizer) {
    return (
      <>
        <Button
          full
          size="lg"
          variant="dark"
          accessibilityLabel="Manage Event"
          onPress={onNavigateToManage}
        >
          Manage Event
        </Button>
        {isGoing ? (
          <Button
            full
            size="lg"
            variant="ghost"
            icon={MessageCircle}
            accessibilityLabel="Event Chat"
            onPress={onNavigateToChat}
          >
            Event Chat
          </Button>
        ) : null}
      </>
    );
  }

  if (participationLoading) {
    return (
      <Button full size="lg" variant="dark" disabled accessibilityLabel="Checking participation status">
        Checking participation…
      </Button>
    );
  }

  if (participationError || participationStatus === undefined) {
    return (
      <View style={rsvpStyles.statusError}>
        <AppText variant="bodyMuted">Participation status is unavailable. Retry before joining or responding.</AppText>
        <Button full size="lg" variant="dark" accessibilityLabel="Retry participation status" onPress={onRetryParticipation}>
          Retry Status
        </Button>
      </View>
    );
  }

  if (invitation?.status === 'pending') {
    return (
      <>
        <Button
          full
          size="lg"
          loading={respondInvitation.isPending}
          accessibilityLabel="Accept Invitation"
          onPress={() => void onRespondToInvitation(true)}
        >
          Accept Invitation
        </Button>
        <Button
          full
          size="lg"
          variant="dark"
          loading={respondInvitation.isPending}
          accessibilityLabel="Decline Invitation"
          onPress={() => void onRespondToInvitation(false)}
        >
          Decline Invitation
        </Button>
      </>
    );
  }

  if (isGoing) {
    return (
      <>
        <Button
          full
          size="lg"
          variant="ghost"
          icon={MessageCircle}
          accessibilityLabel="Event Chat"
          onPress={onNavigateToChat}
        >
          Event Chat
        </Button>
        <Button
          full
          size="lg"
          variant="dark"
          loading={leaveEvent.isPending}
          accessibilityLabel="Leave Event"
          onPress={onLeave}
        >
          Leave Event
        </Button>
      </>
    );
  }

  if (isWaitlisted) {
    return (
      <Button
        full
        size="lg"
        variant="dark"
        loading={leaveWaitlist.isPending}
        accessibilityLabel="Leave Waitlist"
        onPress={onLeaveWaitlist}
      >
        Leave Waitlist
      </Button>
    );
  }

  if (isCancelled) {
    return (
      <Button full size="lg" variant="dark" disabled accessibilityLabel="Event Cancelled">
        Event Cancelled
      </Button>
    );
  }

  // none / interested / declined: join row + soft RSVP row
  const joinLabel = isFull ? 'Join Waitlist' : 'Join Event';

  return (
    <>
      <Button
        full
        size="lg"
        loading={joinEvent.isPending}
        disabled={!canJoin}
        accessibilityLabel={joinLabel}
        onPress={onJoin}
      >
        {joinLabel}
      </Button>

      {/* Soft RSVP row — interested / declined toggles */}
      <View style={rsvpStyles.softRow}>
        <Button
          size="sm"
          variant={isInterested ? 'primary' : 'ghost'}
          loading={rsvpEvent.isPending && !isInterested}
          disabled={rsvpEvent.isPending}
          accessibilityLabel={isInterested ? 'Remove Interest' : 'Mark Interested'}
          accessibilityState={{ selected: isInterested }}
          style={rsvpStyles.softBtn}
          onPress={() => {
            if (isInterested) {
              // Remove interest → treated as leave (back to none)
              onLeave();
            } else {
              void onRsvp('interested');
            }
          }}
        >
          {isInterested ? 'Interested ✓' : 'Interested'}
        </Button>
        <Button
          size="sm"
          variant={isDeclined ? 'dark' : 'ghost'}
          loading={rsvpEvent.isPending && !isDeclined}
          disabled={rsvpEvent.isPending}
          accessibilityLabel={isDeclined ? 'Remove Decline' : 'Not Going'}
          accessibilityState={{ selected: isDeclined }}
          style={rsvpStyles.softBtn}
          onPress={() => {
            if (isDeclined) {
              onLeave();
            } else {
              void onRsvp('declined');
            }
          }}
        >
          {isDeclined ? 'Not Going ✓' : 'Not Going'}
        </Button>
      </View>
    </>
  );
}

const rsvpStyles = StyleSheet.create({
  softRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  softBtn: {
    flex: 1
  },
  statusError: {
    alignItems: 'center',
    gap: spacing.sm
  }
});

// ── screen ────────────────────────────────────────────────────────────────────

export function EventDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const responsive = useResponsiveLayout();
  const route = useRoute<Route>();
  const { data: event, isLoading, isError, isRefetching, error, refetch } = useEvent(route.params.eventId);
  const {
    data: participationStatus,
    isLoading: participationLoading,
    isError: participationIsError,
    isRefetching: participationRefetching,
    refetch: refetchParticipation
  } = useEventParticipation(route.params.eventId);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const leaveWaitlist = useLeaveEventWaitlist();
  const rsvpEvent = useRsvpEvent();
  const { data: invitation, refetch: refetchInvitation } = useMyEventInvitation(route.params.eventId);
  const respondInvitation = useRespondEventInvitation();
  const profile = useAuthStore((state) => state.profile);
  const [useRawCover, setUseRawCover] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const participationActionInFlightRef = useRef(false);

  useEffect(() => {
    setUseRawCover(false);
  }, [event?.coverUrl]);

  const handleJoin = async () => {
    if (!event || participationLoading || participationIsError || participationStatus === undefined) return;
    if (participationActionInFlightRef.current) return;
    participationActionInFlightRef.current = true;
    try {
      const result = await joinEvent.mutateAsync(event.id);
      if (result === 'waitlisted') {
        Alert.alert('Added to waitlist', 'You will be promoted automatically if a spot opens.');
      } else {
        Alert.alert('Joined event', 'You are on the attendee list.');
      }
      await Promise.all([refetch(), refetchParticipation()]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to join event');
    } finally {
      participationActionInFlightRef.current = false;
    }
  };

  const handleRsvp = async (status: 'interested' | 'declined') => {
    if (!event || participationLoading || participationIsError || participationStatus === undefined) return;
    if (participationActionInFlightRef.current) return;
    participationActionInFlightRef.current = true;
    try {
      await rsvpEvent.mutateAsync({ eventId: event.id, status });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update RSVP.');
    } finally {
      participationActionInFlightRef.current = false;
    }
  };

  const handleLeaveWaitlist = () => {
    if (!event) return;
    Alert.alert('Leave waitlist', 'You will lose your current place in the queue.', [
      { text: 'Keep Place', style: 'cancel' },
      {
        text: 'Leave Waitlist',
        style: 'destructive',
        onPress: async () => {
          if (participationActionInFlightRef.current) return;
          participationActionInFlightRef.current = true;
          try {
            await leaveWaitlist.mutateAsync(event.id);
            Alert.alert('Waitlist left', 'You are no longer waiting for this event.');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to leave the waitlist');
          } finally {
            participationActionInFlightRef.current = false;
          }
        }
      }
    ]);
  };

  const handleLeave = async () => {
    if (!event) return;
    Alert.alert('Leave Event', 'Are you sure you want to leave this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          if (participationActionInFlightRef.current) return;
          participationActionInFlightRef.current = true;
          try {
            await leaveEvent.mutateAsync(event.id);
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to leave event');
          } finally {
            participationActionInFlightRef.current = false;
          }
        }
      }
    ]);
  };

  const handleShare = () => {
    if (event) {
      shareEvent(event);
    }
  };

  const respondToInvitation = async (accept: boolean) => {
    if (!invitation || participationActionInFlightRef.current) return;
    participationActionInFlightRef.current = true;
    try {
      const result = await respondInvitation.mutateAsync({ invitationId: invitation.id, accept });
      await Promise.all([refetch(), refetchParticipation(), refetchInvitation()]);
      if (accept) Alert.alert(result === 'waitlisted' ? 'Added to waitlist' : 'Invitation accepted', result === 'waitlisted' ? 'The event is full, so you have been added to the waitlist.' : 'You are on the attendee list.');
    } catch (err) {
      Alert.alert('Invitation update failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      participationActionInFlightRef.current = false;
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        <View style={styles.loading}>
          <AppText variant="h3">Could not load event</AppText>
          <AppText variant="bodyMuted" style={styles.centerText}>
            {error instanceof Error ? error.message : 'Please try again.'}
          </AppText>
          <Button onPress={() => void refetch()}>Retry</Button>
        </View>
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        <View style={styles.loading}>
          <AppText variant="h3">Event not found</AppText>
          <Button onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      </Screen>
    );
  }

  const isOrganizer = profile?.id === event.organizer.id;
  const isWaitlisted = participationStatus === 'waitlisted';
  const isFull = event.playerCount >= event.maxPlayers || event.status === 'full';
  const optimizedCoverUrl = mediaVariants.eventCover(event.coverUrl);
  const coverImageUrl = useRawCover ? event.coverUrl : optimizedCoverUrl ?? event.coverUrl;
  const feeDescription = event.entryFeeCents > 0
    ? `${event.entryFeeLabel} listed. ${eventPaymentNotice}`
    : 'Free event';

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching || participationRefetching}
          onRefresh={() => void Promise.all([refetch(), refetchParticipation()])}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        {!isOrganizer ? (
          <IconButton
            accessibilityLabel="Report event"
            icon={Flag}
            onPress={() => setReportSheetOpen(true)}
          />
        ) : null}
        <IconButton accessibilityLabel="Share event" icon={Share2} onPress={handleShare} />
      </View>
      <View style={[styles.detailLayout, responsive.isExpanded ? styles.detailLayoutExpanded : null]}>
        <View style={styles.mediaColumn}>
          <View style={[styles.hero, responsive.isExpanded ? styles.heroExpanded : null]}>
            {event.coverUrl ? (
              <Image
                source={{ uri: coverImageUrl ?? event.coverUrl }}
                style={styles.coverImage}
                resizeMode="cover"
                onError={() => {
                  if (!useRawCover && optimizedCoverUrl !== event.coverUrl) {
                    setUseRawCover(true);
                  }
                }}
              />
            ) : (
              <CourtArt />
            )}
            <LinearGradient colors={['transparent', theme.mediaGradientEnd]} style={styles.heroGradient} />
            {event.status === 'live' && <Badge tone="red" style={styles.liveBadge}>LIVE</Badge>}
            {event.status === 'cancelled' && <Badge tone="red" style={styles.liveBadge}>CANCELLED</Badge>}
            {(isFull || event.status === 'full') && event.status !== 'cancelled' && <Badge tone="orange" style={styles.liveBadge}>FULL</Badge>}
          </View>
        </View>
        <View style={[styles.body, responsive.isExpanded ? styles.bodyExpanded : null]}>
        <View style={styles.badges}>
          <Badge tone="orange">{event.sport}</Badge>
          <Badge tone="dark">{event.eventType}</Badge>
          <Badge tone={event.visibility === 'public' ? 'blue' : 'yellow'}>
            {eventVisibilityLabel(event.visibility)}
          </Badge>
          {isWaitlisted ? <Badge tone="yellow">WAITLISTED</Badge> : null}
          {participationStatus === 'interested' ? <Badge tone="blue">INTERESTED</Badge> : null}
          {participationStatus === 'declined' ? <Badge tone="dark">NOT GOING</Badge> : null}
          {invitation?.status === 'pending' ? <Badge tone="blue">INVITED</Badge> : null}
        </View>
        <AppText variant="h1" style={styles.title}>{event.title}</AppText>
        <View style={styles.metaRow}>
          <CalendarDays size={14} color={theme.accent} />
          <AppText variant="bodyMuted">{eventDate(event.startsAt)}</AppText>
          <Clock size={14} color={theme.accent} />
          <AppText variant="bodyMuted">{formatTime(event.startsAt)}</AppText>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={16} color={theme.accent} />
          <AppText variant="bodyMuted">{event.locationName}, {event.city}</AppText>
        </View>
        <AppText variant="bodyMuted">{feeDescription}</AppText>
        <Card style={styles.players}>
          <View style={styles.playersTop}>
            <AppText style={styles.playersLabel}>Players</AppText>
            <AppText style={[styles.playersCount, { color: theme.accent }]}>{event.playerCount}<AppText style={[styles.max, { color: theme.textSubtle }]}>/{event.maxPlayers}</AppText></AppText>
          </View>
          <ProgressBar value={event.playerCount} max={event.maxPlayers} height={5} />
          <View style={styles.stack}>
            {event.attendees.slice(0, 8).map((user, index) => (
              <View key={user.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                <Avatar
                  initials={user.initials}
                  uri={user.avatarUrl}
                  size={32}
                  tone={index % 2 === 0 ? 'orange' : 'green'}
                  accessibilityLabel={`View ${user.displayName}'s profile`}
                  onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                />
              </View>
            ))}
            {event.attendees.length > 8 && (
              <View style={{ marginLeft: -8 }}>
                <Avatar initials={`+${event.attendees.length - 8}`} size={32} tone="dark" />
              </View>
            )}
          </View>
        </Card>
        <AppText variant="h4">About This Event</AppText>
        <AppText variant="bodyMuted" style={styles.description}>{event.description}</AppText>
        <AppText variant="h4">Organised By</AppText>
        <View style={styles.organizer}>
          <Avatar
            initials={event.organizer.initials}
            uri={event.organizer.avatarUrl}
            size={44}
            accessibilityLabel={`View ${event.organizer.displayName}'s profile`}
            onPress={() => navigation.navigate('UserProfile', { userId: event.organizer.id })}
          />
          <View style={{ flex: 1 }}>
            <VerifiedName
              profile={event.organizer}
              style={styles.organizerName}
              numberOfLines={1}
              onPress={() => navigation.navigate('UserProfile', { userId: event.organizer.id })}
            />
            <AppText variant="small">Event organizer</AppText>
          </View>
          <Button variant="dark" size="sm" onPress={() => navigation.navigate('UserProfile', { userId: event.organizer.id })}>
            View Profile
          </Button>
        </View>

        {event.sourceGroup && (
          <TouchableOpacity
            style={styles.groupLink}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('GroupDetail', { communityId: event.sourceGroup!.id })}
            accessibilityLabel={`View group ${event.sourceGroup.name}`}
          >
            <View style={styles.groupLinkLeft}>
              <Users size={16} color={colors.text.secondary} />
              <View>
                <AppText variant="small" style={{ color: colors.text.tertiary }}>From group</AppText>
                <AppText variant="bodyBold" style={styles.groupLinkName} numberOfLines={1}>
                  {event.sourceGroup.name}
                </AppText>
              </View>
            </View>
            <AppText variant="small" style={styles.groupLinkAction}>View Group</AppText>
          </TouchableOpacity>
        )}

        <RsvpControl
          event={event}
          participationStatus={participationStatus}
          participationLoading={participationLoading}
          participationError={participationIsError}
          isOrganizer={isOrganizer}
          invitation={invitation}
          joinEvent={joinEvent}
          leaveEvent={leaveEvent}
          leaveWaitlist={leaveWaitlist}
          rsvpEvent={rsvpEvent}
          respondInvitation={respondInvitation}
          onJoin={handleJoin}
          onLeave={handleLeave}
          onLeaveWaitlist={handleLeaveWaitlist}
          onRespondToInvitation={respondToInvitation}
          onRsvp={handleRsvp}
          onRetryParticipation={() => void refetchParticipation()}
          onNavigateToChat={() => navigation.navigate('EventChat', { eventId: event.id })}
          onNavigateToManage={() => navigation.navigate('ManageEvent', { eventId: event.id })}
        />

        <Button full size="lg" variant="ghost" onPress={handleShare}>
          Share Event
        </Button>
        </View>
      </View>
      <ReportSheet
        open={reportSheetOpen}
        entityLabel="event"
        entityType="event"
        entityId={event.id}
        onClose={() => setReportSheetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg
  },
  centerText: {
    textAlign: 'center'
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    zIndex: 2
  },
  hero: {
    height: 220,
    marginTop: -52,
    backgroundColor: '#0A1A08'
  },
  heroExpanded: {
    height: 360,
    marginTop: 0,
    borderRadius: 18,
    overflow: 'hidden'
  },
  detailLayout: {
    gap: spacing.md
  },
  detailLayoutExpanded: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screen
  },
  mediaColumn: {
    flex: 0.9,
    minWidth: 0
  },
  coverImage: {
    width: '100%',
    height: '100%'
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90
  },
  liveBadge: {
    position: 'absolute',
    left: spacing.screen,
    top: 72
  },
  body: {
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    marginTop: -10
  },
  bodyExpanded: {
    flex: 1.1,
    minWidth: 0,
    marginTop: 0,
    paddingHorizontal: 0
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  title: {
    fontSize: 28,
    lineHeight: 31
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  players: {
    gap: spacing.sm
  },
  playersTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  playersLabel: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  },
  playersCount: {
    color: colors.orange[500],
    fontFamily: typography.headingBlack,
    fontSize: 20
  },
  max: {
    color: colors.text.tertiary,
    fontSize: 13
  },
  stack: {
    flexDirection: 'row'
  },
  description: {
    marginTop: -4
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  organizerName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  groupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dark[800],
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm
  },
  groupLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  groupLinkName: {
    color: colors.text.primary,
    fontSize: 14
  },
  groupLinkAction: {
    color: colors.orange[500],
    fontFamily: typography.bodyBold
  }
});
