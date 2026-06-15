import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';

import { EventCard } from '@/components/events/EventCard';
import { AppText, Button, Card, SectionHeader, Screen } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const SPORT_FILTERS: (Sport | 'All')[] = ['All', 'Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton'];

/** Build a 7-day window starting from today */
function buildWeekDays() {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

export function EventsScreen() {
  const navigation = useNavigation<Navigation>();
  const { data: events = [], isLoading } = useEvents();
  const joinEvent = useJoinEvent();

  const weekDays = buildWeekDays();
  const [selectedDay, setSelectedDay] = useState<Date>(weekDays[0]);
  const [selectedSport, setSelectedSport] = useState<Sport | 'All'>('All');
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const handleJoin = (eventId: string) => {
    if (joinedIds.has(eventId)) return;
    setJoinedIds((prev) => new Set([...prev, eventId]));
    joinEvent.mutate(eventId);
  };

  /* Filter events by selected sport */
  const sportFiltered =
    selectedSport === 'All' ? events : events.filter((e) => e.sport === selectedSport);

  /* Events for today section (same day as selectedDay) */
  const todayEvents = sportFiltered.filter((e) =>
    isSameDay(new Date(e.startsAt), selectedDay)
  );

  /* Upcoming events: everything after the selected day */
  const upcomingEvents = sportFiltered.filter(
    (e) => startOfDay(new Date(e.startsAt)) > selectedDay
  );

  /* If nothing matches the day filter, fall back to showing first 2 for "Today" */
  const todayDisplay = todayEvents.length > 0 ? todayEvents : sportFiltered.slice(0, 2);
  const upcomingDisplay = upcomingEvents.length > 0 ? upcomingEvents : sportFiltered.slice(2);

  return (
    <Screen withTabPadding contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="h2">
          Events<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <Button size="sm" icon={Plus} onPress={() => navigation.navigate('CreateEvent')}>
          Create
        </Button>
      </View>

      {/* Dynamic 7-day calendar strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendar}
      >
        {weekDays.map((day) => {
          const isActive = isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());
          return (
            <Pressable
              key={day.toISOString()}
              style={[styles.day, isActive ? styles.dayActive : null]}
              onPress={() => setSelectedDay(day)}
            >
              <AppText style={[styles.dayName, isActive ? styles.dayActiveText : null]}>
                {isToday ? 'TODAY' : format(day, 'EEE').toUpperCase()}
              </AppText>
              <AppText style={[styles.dayNumber, isActive ? styles.dayActiveText : null]}>
                {format(day, 'd')}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sport filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {SPORT_FILTERS.map((sport) => (
          <Pressable
            key={sport}
            style={[styles.filterChip, selectedSport === sport ? styles.filterChipActive : null]}
            onPress={() => setSelectedSport(sport)}
          >
            <AppText
              style={[
                styles.filterChipText,
                selectedSport === sport ? styles.filterChipTextActive : null
              ]}
            >
              {sport}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <SectionHeader title={isSameDay(selectedDay, new Date()) ? 'Today' : format(selectedDay, 'EEE, MMM d')} />
        {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {!isLoading && todayDisplay.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>
            No events on this day. Try another day or sport.
          </AppText>
        ) : null}
        {todayDisplay.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            joined={joinedIds.has(event.id)}
            onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
            onJoin={() => handleJoin(event.id)}
          />
        ))}
      </View>

      {upcomingDisplay.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Upcoming"
            action="View all"
            onAction={() => setSelectedDay(weekDays[0])}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcomingDisplay.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              >
                <Card style={styles.upcoming}>
                  <View
                    style={[
                      styles.upcomingIcon,
                      { backgroundColor: event.sport === 'Football' ? '#0D2E18' : '#1A0D00' }
                    ]}
                  >
                    <AppText variant="h2" style={styles.upcomingEmoji}>
                      {sportEmoji(event.sport)}
                    </AppText>
                  </View>
                  <View style={styles.upcomingBody}>
                    <AppText style={styles.upcomingTitle} numberOfLines={2}>
                      {event.title}
                    </AppText>
                    <AppText variant="small">{event.locationName}</AppText>
                    <AppText style={styles.upcomingDate}>{format(new Date(event.startsAt), 'EEE, MMM d')}</AppText>
                    <AppText style={styles.slots}>{event.maxPlayers - event.playerCount} slots left</AppText>
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
  dayActive: {
    backgroundColor: colors.orange[500]
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
  dayActiveText: {
    color: colors.light[0]
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
  filterChipActive: {
    backgroundColor: colors.overlays.orangeSoft,
    borderColor: colors.orange[500]
  },
  filterChipText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.bodyMedium
  },
  filterChipTextActive: {
    color: colors.orange[400]
  },
  section: {
    paddingHorizontal: spacing.screen,
    marginBottom: 22
  },
  empty: {
    textAlign: 'center',
    marginVertical: 20
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
  slots: {
    color: colors.orange[500],
    fontWeight: '700',
    fontSize: 11,
    marginTop: 4
  }
});
