import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, format } from 'date-fns';
import { ChevronLeft } from 'lucide-react-native';


import { AppRefreshControl, AppText, Button, Chip, IconButton, Screen } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import { useCourt } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import { courtService } from '@/services/courtService';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtBooking'>;

export function CourtBookingScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: court, isLoading, isError, isRefetching, refetch } = useCourt(route.params.courtId);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [selectedHour, setSelectedHour] = useState(18);
  const [durationHours, setDurationHours] = useState(1);
  const [booking, setBooking] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(new Date(), index)), []);
  const hours = [6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21];
  const bookingDisabled = !court || !court.availableNow || isLoading || isError;

  const submit = async () => {
    if (!court) return;
    if (!court.availableNow) {
      Alert.alert('Court unavailable', 'This court is not accepting booking requests right now.');
      return;
    }
    const startsAt = new Date(days[selectedDayOffset]);
    startsAt.setHours(selectedHour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);
    if (startsAt <= new Date()) {
      Alert.alert('Choose a future time', 'Court bookings must start in the future.');
      return;
    }
    setBooking(true);
    try {
      await courtService.bookCourt(route.params.courtId, startsAt.toISOString(), endsAt.toISOString());
      Alert.alert('Booking requested', 'Your court booking is pending confirmation.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Booking failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Book Court</AppText>
        <View style={{ width: 40 }} />
      </View>
      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {isError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted">Could not load this court.</AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}
      <AppText variant="h2">{court?.name ?? 'Court'}</AppText>
      {court && !court.availableNow ? (
        <View style={styles.state}>
          <AppText variant="h4">Court unavailable</AppText>
          <AppText variant="bodyMuted">This court is not accepting booking requests right now.</AppText>
        </View>
      ) : null}
      <AppText style={styles.label}>Date</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((day, index) => (
          <Chip key={day.toISOString()} selected={selectedDayOffset === index} onPress={() => setSelectedDayOffset(index)}>
            {format(day, 'EEE d')}
          </Chip>
        ))}
      </ScrollView>
      <AppText style={styles.label}>Start time</AppText>
      <View style={styles.wrap}>
        {hours.map((hour) => (
          <Chip key={hour} selected={selectedHour === hour} onPress={() => setSelectedHour(hour)}>
            {format(new Date(2026, 0, 1, hour), 'h a')}
          </Chip>
        ))}
      </View>
      <AppText style={styles.label}>Duration</AppText>
      <View style={styles.wrap}>
        {[1, 2, 3].map((hours) => (
          <Chip key={hours} selected={durationHours === hours} onPress={() => setDurationHours(hours)}>
            {hours} hr
          </Chip>
        ))}
      </View>
      <Button full size="lg" loading={booking} disabled={bookingDisabled} onPress={submit}>
        {court?.availableNow ? 'Request Booking' : 'Booking Unavailable'}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  }
});
