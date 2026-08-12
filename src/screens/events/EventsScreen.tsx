import { useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, isAfter, isSameDay, startOfDay } from 'date-fns';

import { EventCard } from '@/components/events/EventCard';

import { AppRefreshControl, AppText, Button, Card, SectionHeader, Screen, IconButton } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useEventParticipationBatch, useEvents, useJoinEvent, useLeaveEventWaitlist, useRsvpEvent } from '@/hooks/useEvents';
import { formatLocalizedDate, useAppTranslation } from '@/i18n';
import type { AppStackParamList } from '@/navigation/routes';
import type { EventParticipationStatus, Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const SPORT_FILTERS: (Sport | 'All')[] = ['All', 'Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton'];

/** Build a 7-day window starting from today */
function buildWeekDays() {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

const participationLabel = (status: EventParticipationStatus, t: (key: string) => string) => {
  switch (status) {
    case 'going':
      return t('events.going');
    case 'waitlisted':
      return t('events.waitlisted');
    case 'interested':
      return t('events.interested');
    case 'declined':
      return t('events.declined');
    default:
      return null;
  }
};

export function EventsScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const eventsQuery = useEvents();
  const events = Array.isArray(eventsQuery.data)
    ? eventsQuery.data
    : eventsQuery.data?.pages.flatMap((page) => page.events) ?? [];
  const { isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = eventsQuery;
  const joinEvent = useJoinEvent();
  const leaveWaitlist = useLeaveEventWaitlist();
  const rsvpEvent = useRsvpEvent();
  const {
    data: participationByEvent,
    isLoading: participationLoading,
    isError: participationIsError,
    error: participationError,
    isRefetching: participationRefetching,
    refetch: refetchParticipation
  } = useEventParticipationBatch(events.map((event) => event.id));

  const weekDays = buildWeekDays();
  const [selectedDay, setSelectedDay] = useState<Date>(weekDays[0]);
  const [selectedSport, setSelectedSport] = useState<Sport | 'All'>('All');
  const [participationActionEventId, setParticipationActionEventId] = useState<string | null>(null);
  const [rsvpActionEventId, setRsvpActionEventId] = useState<string | null>(null);

  const participationLocksRef = useRef(new Set<string>());

  const participationIsKnown = (eventId: string) =>
    !participationLoading
    && !participationIsError
    && participationByEvent?.[eventId] !== undefined;

  const beginParticipationAction = (eventId: string) => {
    if (participationLocksRef.current.has(eventId)) return false;
    participationLocksRef.current.add(eventId);
    return true;
  };

  const finishParticipationAction = (eventId: string) => {
    participationLocksRef.current.delete(eventId);
  };

  const leaveEventWaitlist = (eventId: string) => {
    Alert.alert('Leave waitlist', 'You will lose your current place in the queue.', [
      { text: 'Keep Place', style: 'cancel' },
      {
        text: 'Leave Waitlist',
        style: 'destructive',
        onPress: async () => {
          if (!participationIsKnown(eventId) || !beginParticipationAction(eventId)) return;
          setParticipationActionEventId(eventId);
          try {
            await leaveWaitlist.mutateAsync(eventId);
            Alert.alert('Waitlist left', 'You are no longer waiting for this event.');
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to leave the waitlist');
          } finally {
            finishParticipationAction(eventId);
            setParticipationActionEventId(null);
          }
        }
      }
    ]);
  };

  const handleParticipationAction = async (eventId: string) => {
    if (!participationIsKnown(eventId) || participationActionEventId || rsvpActionEventId) return;
    const currentStatus = participationByEvent?.[eventId];
    if (!currentStatus) return;
    if (currentStatus === 'waitlisted') {
      leaveEventWaitlist(eventId);
      return;
    }
    // none, interested, and declined may all attempt to join
    if (currentStatus === 'going') return;
    if (!beginParticipationAction(eventId)) return;

    setParticipationActionEventId(eventId);
    try {
      const result = await joinEvent.mutateAsync(eventId);
      if (result === 'waitlisted') {
        Alert.alert('Added to waitlist', 'You will be promoted automatically if a spot opens.');
      } else {
        Alert.alert('Joined event', 'You are on the attendee list.');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join event');
    } finally {
      finishParticipationAction(eventId);
      setParticipationActionEventId(null);
    }
  };

  const handleRsvpAction = async (eventId: string, status: 'interested' | 'declined' | null) => {
    if (!participationIsKnown(eventId) || rsvpActionEventId || participationActionEventId) return;
    if (!beginParticipationAction(eventId)) return;
    setRsvpActionEventId(eventId);
    try {
      if (status === null) {
        // Remove soft RSVP — server treats this as a leave (back to none)
        await leaveWaitlist.mutateAsync(eventId);
      } else {
        await rsvpEvent.mutateAsync({ eventId, status });
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update RSVP.');
    } finally {
      finishParticipationAction(eventId);
      setRsvpActionEventId(null);
    }
  };

  const handleRefresh = () => {
    void Promise.all([refetch(), refetchParticipation()]);
  };

  const loadMore = (event: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (hasNextPage && !isFetchingNextPage && layoutMeasurement.height + contentOffset.y >= contentSize.height - 500) {
      void fetchNextPage();
    }
  };

  /* Filter events by selected sport */
  const sportFiltered =
    selectedSport === 'All' ? events : events.filter((e) => e.sport === selectedSport);

  /* Events for today section (same day as selectedDay) */
  const todayEvents = sportFiltered.filter((e) =>
    isSameDay(new Date(e.startsAt), selectedDay)
  );

  const upcomingEvents = sportFiltered.filter((event) =>
    isAfter(startOfDay(new Date(event.startsAt)), selectedDay)
  );

  return (
    <Screen
      withTabPadding
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching || participationRefetching}
          onRefresh={handleRefresh}
        />
      }
      onScroll={loadMore}
      scrollEventThrottle={200}
    >
      <View style={styles.header}>
        <AppText variant="h2">
          {t('events.title')}<AppText variant="h2" color={theme.accent}>.</AppText>
        </AppText>
        <View style={styles.headerActions}>
          {isRefetching || participationRefetching ? (
            <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 8 }} />
          ) : (
            <IconButton icon={RefreshCw} onPress={handleRefresh} />
          )}
          <Button size="sm" icon={Plus} onPress={() => navigation.navigate('CreateEvent')}>
            {t('common.create')}
          </Button>
        </View>
      </View>

      {/* Dynamic 7-day calendar strip */}
      <ScrollView
        horizontal
        style={styles.horizontalScroller}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendar}
      >
        {weekDays.map((day) => {
          const isActive = isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());
          return (
            <Pressable
              key={day.toISOString()}
              style={[
                styles.day,
                { backgroundColor: isActive ? theme.accent : theme.surface }
              ]}
              onPress={() => setSelectedDay(day)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={isToday ? t('events.today') : formatLocalizedDate(day, { weekday: 'long', month: 'long', day: 'numeric' })}
              accessibilityState={{ selected: isActive }}
            >
              <AppText style={[styles.dayName, { color: isActive ? theme.onAccent : theme.textSubtle }]}>
                {isToday ? t('events.today').toLocaleUpperCase() : formatLocalizedDate(day, { weekday: 'short' }).toLocaleUpperCase()}
              </AppText>
              <AppText style={[styles.dayNumber, { color: isActive ? theme.onAccent : theme.textMuted }]}>
                {formatLocalizedDate(day, { day: 'numeric' })}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sport filter chips */}
      <ScrollView
        horizontal
        style={styles.horizontalScroller}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {SPORT_FILTERS.map((sport) => (
          <Pressable
            key={sport}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedSport === sport ? theme.accentSoft : theme.surface,
                borderColor: selectedSport === sport ? theme.accent : theme.border
              }
            ]}
            onPress={() => setSelectedSport(sport)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('events.filterBy', { sport })}
            accessibilityState={{ selected: selectedSport === sport }}
          >
            <AppText
              style={[
                styles.filterChipText,
                { color: selectedSport === sport ? theme.accent : theme.textMuted }
              ]}
            >
              {sport}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <SectionHeader title={isSameDay(selectedDay, new Date()) ? t('events.today') : formatLocalizedDate(selectedDay, { weekday: 'short', month: 'short', day: 'numeric' })} />
        {isLoading ? <ActivityIndicator color={theme.accent} /> : null}
        {isError ? (
          <AppText variant="bodyMuted" style={styles.empty}>
            {t('events.loadError')}
          </AppText>
        ) : null}
        {participationIsError ? (
          <View style={styles.participationError}>
            <AppText variant="bodyMuted">
              {participationError instanceof Error ? participationError.message : 'Could not load participation status.'}
            </AppText>
            <Button size="sm" onPress={() => void refetchParticipation()}>Retry status</Button>
          </View>
        ) : null}
        {!isLoading && !isError && todayEvents.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>
            {t('events.empty')}
          </AppText>
        ) : null}
        {todayEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            participationStatus={participationByEvent?.[event.id]}
            participationLoading={participationLoading}
            participationError={participationIsError || (!participationLoading && participationByEvent?.[event.id] === undefined)}
            actionPending={participationActionEventId === event.id || rsvpActionEventId === event.id}
            rsvpPending={rsvpActionEventId === event.id || participationActionEventId === event.id}
            onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
            onParticipationAction={() => void handleParticipationAction(event.id)}
            onRsvpAction={(status) => void handleRsvpAction(event.id, status)}
          />
        ))}
        {isFetchingNextPage ? <ActivityIndicator color={theme.accent} /> : null}
      </View>

      {upcomingEvents.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title={t('events.upcoming')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroller}>
            {upcomingEvents.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              >
                <Card style={styles.upcoming}>
                  <View
                    style={[
                      styles.upcomingIcon,
                      { backgroundColor: event.sport === 'Football' ? theme.success : theme.accentSoft }
                    ]}
                  >
                    <AppText variant="h2" style={styles.upcomingEmoji}>
                      {sportEmoji(event.sport)}
                    </AppText>
                  </View>
                  <View style={styles.upcomingBody}>
                    <AppText style={[styles.upcomingTitle, { color: theme.text }]} numberOfLines={2}>
                      {event.title}
                    </AppText>
                    <AppText variant="small">{event.eventType}</AppText>
                    <AppText variant="small">{event.locationName}</AppText>
                    <AppText style={[styles.upcomingDate, { color: theme.textSubtle }]}>{formatLocalizedDate(event.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })}</AppText>
                    {participationByEvent?.[event.id] && participationLabel(participationByEvent[event.id], t) ? (
                      <AppText style={[styles.participationStatus, { color: theme.success }]}>
                        {participationLabel(participationByEvent[event.id], t)}
                      </AppText>
                    ) : null}
                    {participationByEvent?.[event.id] === 'waitlisted' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={participationActionEventId === event.id}
                        onPress={(pressEvent) => {
                          pressEvent.stopPropagation();
                          void handleParticipationAction(event.id);
                        }}
                      >
                        {t('events.leaveWaitlist')}
                      </Button>
                    ) : null}
                    <AppText style={[styles.slots, { color: theme.accent }]}>{t('events.slotsLeft', { count: Math.max(0, event.maxPlayers - event.playerCount) })}</AppText>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}

function sportEmoji(sport: string) {
  const map: Record<string, string> = {
    Basketball: '🏀',
    Football: '⚽',
    Tennis: '🎾',
    Cricket: '🏏',
    Badminton: '🏸'
  };
  return map[sport] ?? '🏅';
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    marginBottom: 16
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  horizontalScroller: {
    flexGrow: 0
  },
  calendar: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 14,
    gap: spacing.sm
  },
  day: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.dark[800]
  },
  dayName: {
    color: colors.text.tertiary,
    fontSize: 9,
    fontFamily: typography.bodyBold,
    letterSpacing: 0.4
  },
  dayNumber: {
    color: colors.text.secondary,
    fontWeight: '700',
    marginTop: 2,
    fontSize: 15
  },
  filters: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 16,
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.dark[800],
    borderWidth: 1,
    borderColor: colors.dark[700]
  },
  filterChipText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.bodyMedium
  },
  section: {
    paddingHorizontal: spacing.screen,
    marginBottom: 22
  },
  empty: {
    textAlign: 'center',
    marginVertical: 20
  },
  participationError: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  upcoming: {
    width: 160,
    padding: 0,
    marginRight: spacing.sm,
    overflow: 'hidden'
  },
  upcomingIcon: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center'
  },
  upcomingEmoji: {
    fontSize: 30
  },
  upcomingBody: {
    padding: 10,
    gap: 3
  },
  upcomingTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 13
  },
  upcomingDate: {
    color: colors.text.tertiary,
    fontSize: 11,
    marginTop: 2
  },
  participationStatus: {
    color: colors.semantic.success,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    marginTop: 2
  },
  slots: {
    color: colors.orange[500],
    fontWeight: '700',
    fontSize: 11,
    marginTop: 4
  }
});
