import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { AppRefreshControl, AppText, Button, Chip, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing } from '@/design/tokens';
import { useBookCourt, useCourt, useCourtAvailability } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import type { CourtAvailabilitySlot } from '@/types/domain';
import {
  buildCourtBookingDateKeys,
  courtDateKey,
  formatCourtDate,
  formatCourtDateKey,
  formatCourtTime
} from '@/utils/courtTime';
import { currency } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtBooking'>;

const DATE_PAGE_SIZE = 14;

export function CourtBookingScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const { data: court, isLoading, isError, isRefetching, refetch } = useCourt(route.params.courtId);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const timezone = court?.timezone ?? 'UTC';
  const dateKeys = useMemo(
    () => court
      ? buildCourtBookingDateKeys(nowIso, court.timezone, court.bookingWindowDays)
      : [],
    [court, nowIso]
  );
  const rangeStart = dateKeys[0] ?? '';
  const rangeEnd = dateKeys[dateKeys.length - 1] ?? '';
  const availability = useCourtAvailability(route.params.courtId, rangeStart, rangeEnd);
  const bookCourt = useBookCourt(route.params.courtId);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStartsAt, setSelectedStartsAt] = useState('');
  const [datePage, setDatePage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNowIso(new Date().toISOString()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, CourtAvailabilitySlot[]>();
    for (const slot of availability.data ?? []) {
      if (new Date(slot.startsAt).getTime() <= new Date(nowIso).getTime()) continue;
      const day = courtDateKey(slot.startsAt, timezone);
      grouped.set(day, [...(grouped.get(day) ?? []), slot]);
    }
    return grouped;
  }, [availability.data, nowIso, timezone]);

  const availableDateKeys = useMemo(() => new Set(slotsByDay.keys()), [slotsByDay]);
  const visibleDateKeys = dateKeys.slice(
    datePage * DATE_PAGE_SIZE,
    (datePage + 1) * DATE_PAGE_SIZE
  );
  const pageCount = Math.max(1, Math.ceil(dateKeys.length / DATE_PAGE_SIZE));
  const selectedSlots = slotsByDay.get(selectedDay) ?? [];
  const selectedSlot = selectedSlots.find((slot) => slot.startsAt === selectedStartsAt);

  useEffect(() => {
    if (!dateKeys.length) {
      setSelectedDay('');
      setSelectedStartsAt('');
      setDatePage(0);
      return;
    }
    if (!dateKeys.includes(selectedDay) || !slotsByDay.has(selectedDay)) {
      const nextDay = dateKeys.find((dateKey) => slotsByDay.has(dateKey)) ?? dateKeys[0];
      setSelectedDay(nextDay);
      setSelectedStartsAt('');
      setDatePage(Math.floor(dateKeys.indexOf(nextDay) / DATE_PAGE_SIZE));
    }
    setDatePage((current) => Math.min(current, pageCount - 1));
  }, [dateKeys, pageCount, selectedDay, slotsByDay]);

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

      {isLoading ? <ActivityIndicator color={theme.accent} /> : null}
      {isError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted">Could not load this court.</AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}

      <AppText variant="h2">{court?.name ?? 'Court'}</AppText>
      {court ? (
        <View style={[styles.policy, { backgroundColor: theme.surface }]}>
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
          <ActivityIndicator color={theme.accent} />
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
      {!availability.isLoading && !availability.isError && (availability.data ?? []).length === 0 ? (
        <View style={styles.state}>
          <AppText variant="h4">No available slots</AppText>
          <AppText variant="bodyMuted">
            Operating hours, closures, and existing bookings leave no openings in this date range.
          </AppText>
          <Button size="sm" onPress={() => void availability.refetch()}>Refresh</Button>
        </View>
      ) : null}

      {dateKeys.length && !availability.isLoading && !availability.isError ? (
        <>
          <AppText style={[styles.label, { color: theme.textSubtle }]}>Available date</AppText>
          {pageCount > 1 ? (
            <View style={styles.dateNavigation}>
              <Button
                size="sm"
                variant="dark"
                disabled={datePage === 0}
                accessibilityLabel="Previous booking dates"
                onPress={() => setDatePage((page) => Math.max(0, page - 1))}
              >
                Previous
              </Button>
              <AppText variant="small">{datePage + 1} of {pageCount}</AppText>
              <Button
                size="sm"
                variant="dark"
                disabled={datePage >= pageCount - 1}
                accessibilityLabel="Next booking dates"
                onPress={() => setDatePage((page) => Math.min(pageCount - 1, page + 1))}
              >
                Next
              </Button>
            </View>
          ) : null}
          <ScrollView horizontal style={styles.filterScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {visibleDateKeys.map((day) => {
              const available = availableDateKeys.has(day);
              return (
                <Chip
                  key={day}
                  selected={selectedDay === day}
                  disabled={!available}
                  accessibilityLabel={`${formatCourtDateKey(day)}${available ? '' : ', unavailable'}`}
                  onPress={() => {
                    setSelectedDay(day);
                    setSelectedStartsAt('');
                  }}
                >
                  {formatCourtDateKey(day)}
                </Chip>
              );
            })}
          </ScrollView>

          <AppText style={[styles.label, { color: theme.textSubtle }]}>Available slot</AppText>
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
        <View style={[styles.summary, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
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
  filterScroller: {
    flexGrow: 0
  },
  filterContent: {
    alignItems: 'center',
    gap: spacing.xs
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
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
