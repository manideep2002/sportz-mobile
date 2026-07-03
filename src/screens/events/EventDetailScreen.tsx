import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, Clock, MapPin, Share2, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Image, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Card, IconButton, ProgressBar, Screen } from '@/components/ui';
import { CourtArt } from '@/components/feed/CourtArt';
import { colors, spacing, typography } from '@/design/tokens';
import { useEvent, useJoinEvent, useLeaveEvent, useCheckAttendance } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import { eventDate, formatTime } from '@/utils/format';
import { shareEvent } from '@/utils/share';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'EventDetail'>;

export function EventDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: event, isLoading, isError, error, refetch } = useEvent(route.params.eventId);
  const { data: attendanceStatus } = useCheckAttendance(route.params.eventId);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const profile = useAuthStore((state) => state.profile);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!event) return;
    setIsJoining(true);
    try {
      const result = await joinEvent.mutateAsync(event.id);
      if (result === 'waitlisted') {
        Alert.alert('Added to waitlist', 'You will be promoted if a spot opens.');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join event');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!event) return;
    Alert.alert('Leave Event', 'Are you sure you want to leave this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveEvent.mutateAsync(event.id);
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to leave event');
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

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.orange[500]} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
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
      <Screen>
        <View style={styles.loading}>
          <AppText variant="h3">Event not found</AppText>
          <Button onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      </Screen>
    );
  }

  const isOrganizer = profile?.id === event.organizer.id;
  const hasJoined = attendanceStatus === 'going';
  const isFull = event.playerCount >= event.maxPlayers;
  const canJoin = !hasJoined && (event.status === 'open' || event.status === 'full');

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton icon={Share2} onPress={handleShare} />
      </View>
      <View style={styles.hero}>
        {event.coverUrl ? (
          <Image source={{ uri: event.coverUrl }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <CourtArt />
        )}
        <LinearGradient colors={['transparent', colors.dark[950]]} style={styles.heroGradient} />
        {event.status === 'live' && <Badge tone="red" style={styles.liveBadge}>LIVE</Badge>}
        {event.status === 'cancelled' && <Badge tone="red" style={styles.liveBadge}>CANCELLED</Badge>}
        {(isFull || event.status === 'full') && event.status !== 'cancelled' && <Badge tone="orange" style={styles.liveBadge}>FULL</Badge>}
      </View>
      <View style={styles.body}>
        <Badge tone="orange">{event.sport}</Badge>
        <AppText variant="h1" style={styles.title}>{event.title}</AppText>
        <View style={styles.metaRow}>
          <CalendarDays size={14} color={colors.orange[500]} />
          <AppText variant="bodyMuted">{eventDate(event.startsAt)}</AppText>
          <Clock size={14} color={colors.orange[500]} />
          <AppText variant="bodyMuted">{formatTime(event.startsAt)}</AppText>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={16} color={colors.orange[500]} />
          <AppText variant="bodyMuted">{event.locationName}, {event.city}</AppText>
        </View>
        <Card style={styles.players}>
          <View style={styles.playersTop}>
            <AppText style={styles.playersLabel}>Players</AppText>
            <AppText style={styles.playersCount}>{event.playerCount}<AppText style={styles.max}>/{event.maxPlayers}</AppText></AppText>
          </View>
          <ProgressBar value={event.playerCount} max={event.maxPlayers} height={5} />
          <View style={styles.stack}>
            {event.attendees.slice(0, 8).map((user, index) => (
              <View key={user.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                <Avatar initials={user.initials} uri={user.avatarUrl} size={32} tone={index % 2 === 0 ? 'orange' : 'green'} />
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
          <Avatar initials={event.organizer.initials} uri={event.organizer.avatarUrl} size={44} />
          <View style={{ flex: 1 }}>
            <AppText style={styles.organizerName}>{event.organizer.displayName}</AppText>
            <AppText variant="small">Event organizer</AppText>
          </View>
          <Button variant="dark" size="sm" onPress={() => navigation.navigate('UserProfile', { userId: event.organizer.id })}>
            View Profile
          </Button>
        </View>
        
        {isOrganizer ? (
          <>
            <Button full size="lg" variant="dark" onPress={() => navigation.navigate('ManageEvent', { eventId: event.id })}>
              Manage Event
            </Button>
            {hasJoined ? (
              <Button full size="lg" variant="ghost" icon={MessageCircle} onPress={() => navigation.navigate('EventChat', { eventId: event.id })}>
                Event Chat
              </Button>
            ) : null}
          </>
        ) : hasJoined ? (
          <>
            <Button full size="lg" variant="ghost" icon={MessageCircle} onPress={() => navigation.navigate('EventChat', { eventId: event.id })}>
              Event Chat
            </Button>
            <Button full size="lg" variant="dark" onPress={handleLeave}>
              Leave Event
            </Button>
          </>
        ) : event.status === 'cancelled' ? (
          <Button full size="lg" variant="dark" disabled>
            Event Cancelled
          </Button>
        ) : (
          <Button
            full
            size="lg"
            loading={isJoining}
            onPress={handleJoin}
            disabled={!canJoin}
          >
            {isFull || event.status === 'full' ? 'Join Waitlist' : `Join Event - ${event.entryFeeLabel}`}
          </Button>
        )}
        <Button full size="lg" variant="ghost" onPress={handleShare}>
          Share Event
        </Button>
      </View>
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
  }
});
