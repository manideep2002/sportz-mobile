import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { EventCard } from '@/components/events/EventCard';
import { AppText, Button, Card, SectionHeader, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const days = ['MON 21', 'TUE 22', 'WED 23', 'THU 24', 'FRI 25', 'SAT 26', 'SUN 27'];

export function EventsScreen() {
  const navigation = useNavigation<Navigation>();
  const { data: events = [], isLoading } = useEvents();
  const joinEvent = useJoinEvent();

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendar}>
        {days.map((day, index) => (
          <View key={day} style={[styles.day, index === 2 ? styles.dayActive : null]}>
            <AppText style={[styles.dayName, index === 2 ? styles.dayActiveText : null]}>{day.split(' ')[0]}</AppText>
            <AppText style={[styles.dayNumber, index === 2 ? styles.dayActiveText : null]}>{day.split(' ')[1]}</AppText>
          </View>
        ))}
      </ScrollView>
      <View style={styles.section}>
        <SectionHeader title="Today" />
        {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {events.slice(0, 2).map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
            onJoin={() => joinEvent.mutate(event.id)}
          />
        ))}
      </View>
      <View style={styles.section}>
        <SectionHeader title="Upcoming" action="View all" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {events.slice(2).map((event) => (
            <Card key={event.id} style={styles.upcoming}>
              <View style={styles.upcomingIcon}>
                <AppText variant="h2">{event.sport.slice(0, 1)}</AppText>
              </View>
              <AppText style={styles.upcomingTitle}>{event.title}</AppText>
              <AppText variant="small">{event.locationName}</AppText>
              <AppText style={styles.slots}>{event.maxPlayers - event.playerCount} slots left</AppText>
            </Card>
          ))}
        </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    marginBottom: 16
  },
  calendar: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 18,
    gap: spacing.sm
  },
  day: {
    minWidth: 44,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.dark[800]
  },
  dayActive: {
    backgroundColor: colors.orange[500]
  },
  dayName: {
    color: colors.text.tertiary,
    fontSize: 10
  },
  dayNumber: {
    color: colors.text.secondary,
    fontWeight: '700',
    marginTop: 2
  },
  dayActiveText: {
    color: colors.light[0]
  },
  section: {
    paddingHorizontal: spacing.screen,
    marginBottom: 22
  },
  upcoming: {
    width: 156,
    padding: 0,
    marginRight: spacing.sm
  },
  upcomingIcon: {
    height: 70,
    backgroundColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center'
  },
  upcomingTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 10,
    marginHorizontal: 10
  },
  slots: {
    margin: 10,
    color: colors.orange[500],
    fontWeight: '700',
    fontSize: 11
  }
});
