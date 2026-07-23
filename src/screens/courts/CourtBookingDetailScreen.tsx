import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { CalendarX, ChevronLeft } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useCancelCourtBooking, useCourtBooking } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import type { CourtBooking } from '@/types/domain';
import { formatCourtDate, formatCourtTime } from '@/utils/courtTime';
import { currency } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtBookingDetail'>;

const statusTone = (status: CourtBooking['status']) => {
  if (status === 'confirmed') return 'green' as const;
  if (status === 'cancelled') return 'red' as const;
  return 'orange' as const;
};

export function CourtBookingDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const bookingQuery = useCourtBooking(route.params.bookingId);
  const cancelBooking = useCancelCourtBooking(route.params.bookingId);
  const booking = bookingQuery.data;

  const confirmCancellation = () => {
    if (!booking?.canCancel || cancelBooking.isPending) return;
    Alert.alert(
      'Cancel court booking?',
      `Cancellation is allowed until ${formatCourtDate(booking.cancellationDeadline, booking.court.timezone)} at ${formatCourtTime(booking.cancellationDeadline, booking.court.timezone)}.`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBooking.mutateAsync({ id: booking.id });
              Alert.alert('Booking cancelled', 'The slot has been released for other players.');
            } catch (error) {
              Alert.alert(
                'Cancellation failed',
                error instanceof Error ? error.message : 'Refresh the booking and try again.'
              );
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={bookingQuery.isRefetching}
          onRefresh={() => void bookingQuery.refetch()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Booking Details</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {bookingQuery.isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {bookingQuery.isError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted">
            {bookingQuery.error instanceof Error ? bookingQuery.error.message : 'Could not load this booking.'}
          </AppText>
          <Button size="sm" onPress={() => void bookingQuery.refetch()}>Retry</Button>
        </View>
      ) : null}

      {booking ? (
        <>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <AppText variant="h2">{booking.court.name}</AppText>
              <AppText variant="bodyMuted">{booking.court.address || booking.court.city}</AppText>
            </View>
            <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
          </View>

          <View style={styles.card}>
            <Detail
              label="Date"
              value={formatCourtDate(booking.startsAt, booking.court.timezone)}
            />
            <Detail
              label="Time"
              value={`${formatCourtTime(booking.startsAt, booking.court.timezone)} – ${formatCourtTime(booking.endsAt, booking.court.timezone)}`}
            />
            <Detail label="Timezone" value={booking.court.timezone} />
            <Detail label="Price" value={currency(booking.price, booking.currency)} />
            <Detail
              label="Payment"
              value={booking.court.paymentPolicy === 'external' ? 'Pay venue directly' : 'Not required'}
            />
          </View>

          {booking.status === 'pending' ? (
            <View style={styles.notice}>
              <AppText variant="h4">Awaiting venue confirmation</AppText>
              <AppText variant="small">This pending request reserves the slot and prevents double-booking.</AppText>
            </View>
          ) : null}

          {booking.status !== 'cancelled' ? (
            <View style={styles.notice}>
              <AppText variant="small">
                Cancellation deadline: {formatCourtDate(booking.cancellationDeadline, booking.court.timezone)}
                {' at '}
                {formatCourtTime(booking.cancellationDeadline, booking.court.timezone)}
              </AppText>
              {!booking.canCancel ? (
                <AppText variant="small">
                  Online cancellation is closed. Contact the venue for assistance.
                </AppText>
              ) : null}
            </View>
          ) : null}

          {booking.cancellationReason ? (
            <View style={styles.notice}>
              <AppText variant="small">Cancellation reason: {booking.cancellationReason}</AppText>
            </View>
          ) : null}

          {booking.status !== 'cancelled' ? (
            <Button
              full
              variant="ghost"
              icon={CalendarX}
              loading={cancelBooking.isPending}
              disabled={!booking.canCancel}
              onPress={confirmCancellation}
            >
              Cancel Booking
            </Button>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="small">{label}</AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  flex: {
    flex: 1
  },
  card: {
    gap: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.dark[800],
    padding: spacing.md
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.text.primary,
    fontFamily: typography.bodyBold
  },
  notice: {
    gap: spacing.xs,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    padding: spacing.md
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl
  }
});
