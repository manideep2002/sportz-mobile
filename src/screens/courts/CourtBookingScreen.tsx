import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, format } from 'date-fns';
import { ChevronLeft } from 'lucide-react-native';

import { AppRefreshControl, AppText, Button, Chip, IconButton, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useBookCourt, useCourt, useCourtAvailability } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import type { CourtAvailabilitySlot } from '@/types/domain';
import { courtDateKey, formatCourtDate, formatCourtTime } from '@/utils/courtTime';
import { currency } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtBooking'>;

const addDaysToKey = (dateKey: string, amount: number) =>
  format(addDays(new Date(`${dateKey}T12:00:00.000Z`), amount), 'yyyy-MM-dd');

export function CourtBookingScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: court, isLoading, isError, isRefetching, refetch } = useCourt(route.params.courtId);
  const timezone = court?.timezone ?? 'Asia/Kolkata';
  const rangeStart = courtDateKey(new Date().toISOString(), timezone);
  const rangeEnd = addDaysToKey(rangeStart, Math.min(court?.bookingWindowDays ?? 7, 7));
  const availability = useCourtAvailability(route.params.courtId, rangeStart, rangeEnd);
  const bookCourt = useBookCourt(route.params.courtId);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStartsAt, setSelectedStartsAt] = useState('');

  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, CourtAvailabilitySlot[]>();
    for (const slot of availability.data ?? []) {
      const day = courtDateKey(slot.startsAt, timezone);
      grouped.set(day, [...(grouped.get(day) ?? []), slot]);
    }
    return grouped;
  }, [availability.data, timezone]);

  const days = useMemo(() => [...slotsByDay.keys()], [slotsByDay]);
  const selectedSlots = slotsByDay.get(selectedDay) ?? [];
  const selectedSlot = selectedSlots.find((slot) => slot.startsAt === selectedStartsAt);

  useEffect(() => {
    if (!days.length) {
      setSelectedDay('');
      setSelectedStartsAt('');
      return;
    }
    if (!slotsByDay.has(selectedDay)) {
      setSelectedDay(days[0]);
      setSelectedStartsAt('');
    }
  }, [days, selectedDay, slotsByDay]);

  const refresh = async () => {
    await Promise.all([refetch(), availability.refetch()]);
  };

  const submit = async () => {
    if (!court || !selectedSlot || bookCourt.isPending) return;
    try {
      const result = await bookCourt.mutateAsync({
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt
      });
      Alert.alert(
        result.status === 'confirmed' ? 'Booking confirmed' : 'Booking requested',
        result.status === 'confirmed'
          ? 'Your court slot is confirmed.'
          : 'The venue will review your booking request.',
        [{
          text: 'View booking',
          onPress: () => navigation.replace('CourtBookingDetail', { bookingId: result.bookingId })
        }]
      );
    } catch (error) {
      Alert.alert(
        'Booking failed',
        error instanceof Error ? error.message : 'Refresh availability and try again.'
      );
      await availability.refetch();
    }
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching || availability.isRefetching}
          onRefresh={() => void refresh()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Book Court</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {isError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted">Could not load this court.</AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}

      <AppText variant="h2">{court?.name ?? 'Court'}</AppText>
      {court ? (
        <View style={styles.policy}>
          <AppText variant="small">
            {court.slotDurationMinutes}-minute slots · {court.timezone}
          </AppText>
          <AppText variant="small">
            {court.paymentPolicy === 'external'
              ? 'Payment is handled directly by the venue. SPORTZ does not collect payment.'
              : 'No payment is required for this court.'}
          </AppText>
        </View>
      ) : null}

      {availability.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.orange[500]} />
          <AppText variant="bodyMuted">Checking live availability…</AppText>
        </View>
      ) : null}
      {availability.isError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted">
            {availability.error instanceof Error
              ? availability.error.message
              : 'Could not load available slots.'}
          </AppText>
          <Button size="sm" onPress={() => void availability.refetch()}>Retry</Button>
        </View>
      ) : null}
      {!availability.isLoading && !availability.isError && days.length === 0 ? (
        <View style={styles.state}>
          <AppText variant="h4">No available slots</AppText>
          <AppText variant="bodyMuted">
            Operating hours, closures, and existing bookings leave no openings in this date range.
          </AppText>
          <Button size="sm" onPress={() => void availability.refetch()}>Refresh</Button>
        </View>
      ) : null}

      {days.length ? (
        <>
          <AppText style={styles.label}>Available date</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {days.map((day) => {
              const firstSlot = slotsByDay.get(day)?.[0];
              return (
                <Chip
                  key={day}
                  selected={selectedDay === day}
                  onPress={() => {
                    setSelectedDay(day);
                    setSelectedStartsAt('');
                  }}
                >
                  {firstSlot ? formatCourtDate(firstSlot.startsAt, timezone) : day}
                </Chip>
              );
            })}
          </ScrollView>

          <AppText style={styles.label}>Available slot</AppText>
          <View style={styles.wrap}>
            {selectedSlots.map((slot) => (
              <Chip
                key={slot.startsAt}
                selected={selectedStartsAt === slot.startsAt}
                onPress={() => setSelectedStartsAt(slot.startsAt)}
              >
                {formatCourtTime(slot.startsAt, timezone)}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      {selectedSlot ? (
        <View style={styles.summary}>
          <AppText variant="h4">Booking summary</AppText>
          <AppText variant="small">
            {formatCourtDate(selectedSlot.startsAt, timezone)} · {formatCourtTime(selectedSlot.startsAt, timezone)}
            {' – '}
            {formatCourtTime(selectedSlot.endsAt, timezone)}
          </AppText>
          <AppText variant="small">{currency(selectedSlot.price, selectedSlot.currency)}</AppText>
        </View>
      ) : null}

      <Button
        full
        size="lg"
        loading={bookCourt.isPending}
        disabled={!court?.futureBookable || !selectedSlot || availability.isLoading}
        onPress={() => void submit()}
      >
        {court?.bookingRequiresApproval ? 'Request Booking' : 'Confirm Booking'}
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
  headerSpacer: {
    width: 40
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
  policy: {
    gap: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    padding: spacing.md
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  summary: {
    gap: spacing.xs,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.overlays.orangeBorder,
    backgroundColor: colors.overlays.orangeSoft,
    padding: spacing.md
  }
});
