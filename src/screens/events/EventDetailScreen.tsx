import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, Clock, MapPin, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Card, IconButton, ProgressBar, Screen } from '@/components/ui';
import { CourtArt } from '@/components/feed/CourtArt';
import { colors, spacing, typography } from '@/design/tokens';
import { useEvent, useJoinEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import { eventDate, eventTime } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'EventDetail'>;

export function EventDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: event } = useEvent(route.params.eventId);
  const joinEvent = useJoinEvent();

  if (!event) return null;

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton icon={Share2} />
      </View>
      <View style={styles.hero}>
        <CourtArt />
        <LinearGradient colors={['transparent', colors.dark[950]]} style={styles.heroGradient} />
        <Badge tone="red" style={styles.liveBadge}>LIVE</Badge>
      </View>
      <View style={styles.body}>
        <Badge tone="orange">{event.sport}</Badge>
        <AppText variant="h1" style={styles.title}>{event.title}</AppText>
        <View style={styles.metaRow}>
          <CalendarDays size={14} color={colors.orange[500]} />
          <AppText variant="bodyMuted">{eventDate(event.startsAt)}</AppText>
          <Clock size={14} color={colors.orange[500]} />
          <AppText variant="bodyMuted">{eventTime(event.startsAt)}</AppText>
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
            {event.attendees.map((user, index) => (
              <View key={user.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                <Avatar initials={user.initials} size={32} tone={index % 2 === 0 ? 'orange' : 'green'} />
              </View>
            ))}
          </View>
        </Card>
        <AppText variant="h4">About This Event</AppText>
        <AppText variant="bodyMuted" style={styles.description}>{event.description}</AppText>
        <AppText variant="h4">Organised By</AppText>
        <View style={styles.organizer}>
          <Avatar initials={event.organizer.initials} size={44} />
          <View style={{ flex: 1 }}>
            <AppText style={styles.organizerName}>{event.organizer.displayName}</AppText>
            <AppText variant="small">12 events organised</AppText>
          </View>
          <Button variant="dark" size="sm" onPress={() => navigation.navigate('UserProfile', { userId: event.organizer.id })}>
            View Profile
          </Button>
        </View>
        <Button full size="lg" loading={joinEvent.isPending} onPress={() => joinEvent.mutate(event.id)}>
          Join Event - {event.entryFeeLabel}
        </Button>
        <Button full size="lg" variant="ghost">
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
