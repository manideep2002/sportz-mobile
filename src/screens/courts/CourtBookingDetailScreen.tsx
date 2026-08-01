import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { CalendarX, Check, ChevronLeft, User } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import {
  useCancelCourtBooking,
  useCourtBooking,
  useUpdateCourtBookingStatus
} from '@/hooks/useCourts';
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
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const bookingQuery = useCourtBooking(route.params.bookingId);
  const cancelBooking = useCancelCourtBooking(route.params.bookingId);
  const updateStatus = useUpdateCourtBookingStatus();
  const booking = bookingQuery.data;

  // Reason input shown to admins before cancelling
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  /* ───── Actions ───── */

  const handlePlayerCancel = () => {
    if (!booking?.capabilities.canCancel || cancelBooking.isPending) return;
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

  const handleAdminCancel = async () => {
    if (!booking?.capabilities.canCancel || cancelBooking.isPending) return;
    try {
      await cancelBooking.mutateAsync({ id: booking.id, reason: cancelReason || undefined });
      setShowReasonInput(false);
      setCancelReason('');
      Alert.alert('Booking cancelled', 'The booking has been cancelled and the slot released.');
    } catch (error) {
      Alert.alert(
        'Cancellation failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const handleConfirm = () => {
    if (!booking?.capabilities.canConfirm || updateStatus.isPending) return;
    Alert.alert(
      'Confirm this booking?',
      'The player will be notified that their slot is confirmed.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateStatus.mutateAsync({ bookingId: booking.id, status: 'confirmed' });
              Alert.alert('Booking confirmed', 'The player has been notified.');
            } catch (error) {
              Alert.alert(
                'Confirmation failed',
                error instanceof Error ? error.message : 'Please try again.'
              );
            }
          }
        }
      ]
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

      {bookingQuery.isLoading ? <ActivityIndicator color={theme.accent} /> : null}
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
          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <AppText variant="h2">{booking.court.name}</AppText>
              <AppText variant="bodyMuted">{booking.court.address || booking.court.city}</AppText>
            </View>
            <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
          </View>

          {/* Player profile link — admin only */}
          {booking.capabilities.canViewPlayer ? (
            <Button
              full
              variant="ghost"
              icon={User}
              accessibilityLabel={`View ${booking.user.displayName}'s profile`}
              onPress={() => navigation.navigate('UserProfile', { userId: booking.user.id })}
            >
              {booking.user.displayName}
            </Button>
          ) : null}

          {/* Booking details card */}
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
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

          {/* Pending notice */}
          {booking.status === 'pending' ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppText variant="h4">Awaiting venue confirmation</AppText>
              <AppText variant="small">This pending request reserves the slot and prevents double-booking.</AppText>
            </View>
          ) : null}

          {/* Cancellation deadline — only while booking is active */}
          {booking.status !== 'cancelled' ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppText variant="small">
                Cancellation deadline: {formatCourtDate(booking.cancellationDeadline, booking.court.timezone)}
                {' at '}
                {formatCourtTime(booking.cancellationDeadline, booking.court.timezone)}
              </AppText>
              {!booking.capabilities.canCancel && !booking.capabilities.canConfirm ? (
                <AppText variant="small">
                  Online cancellation is closed. Contact the venue for assistance.
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* Audit trail — cancellation info */}
          {booking.cancelledAt ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppText variant="small">
                Cancelled on {formatCourtDate(booking.cancelledAt, booking.court.timezone)} at{' '}
                {formatCourtTime(booking.cancelledAt, booking.court.timezone)}
              </AppText>
              {booking.cancellationReason ? (
                <AppText variant="small">Reason: {booking.cancellationReason}</AppText>
              ) : null}
            </View>
          ) : null}

          {/* ─── Capability-driven action panel ─── */}

          {/* Admin confirm */}
          {booking.capabilities.canConfirm ? (
            <Button
              full
              icon={Check}
              loading={updateStatus.isPending}
              accessibilityLabel="Confirm Booking"
              onPress={handleConfirm}
            >
              Confirm Booking
            </Button>
          ) : null}

          {/* Admin cancel — inline reason input */}
          {booking.capabilities.canCancel && booking.capabilities.canViewPlayer ? (
            <>
              {showReasonInput ? (
                <View style={[styles.reasonBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <AppText variant="small" style={{ color: theme.textSubtle }}>
                    Cancellation reason (optional)
                  </AppText>
                  <TextInput
                    accessibilityLabel="Cancellation reason"
                    style={[styles.reasonInput, { color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. Court maintenance"
                    placeholderTextColor={theme.textSubtle}
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    maxLength={240}
                    multiline
                  />
                  <View style={styles.reasonActions}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => { setShowReasonInput(false); setCancelReason(''); }}
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={CalendarX}
                      loading={cancelBooking.isPending}
                      accessibilityLabel="Confirm Admin Cancel"
                      onPress={() => void handleAdminCancel()}
                    >
                      Cancel Booking
                    </Button>
                  </View>
                </View>
              ) : (
                <Button
                  full
                  variant="ghost"
                  icon={CalendarX}
                  accessibilityLabel="Cancel Booking"
                  onPress={() => setShowReasonInput(true)}
                >
                  Cancel Booking
                </Button>
              )}
            </>
          ) : null}

          {/* Player cancel — confirmation alert */}
          {booking.capabilities.canCancel && !booking.capabilities.canViewPlayer ? (
            <Button
              full
              variant="ghost"
              icon={CalendarX}
              loading={cancelBooking.isPending}
              accessibilityLabel="Cancel Booking"
              onPress={handlePlayerCancel}
            >
              Cancel Booking
            </Button>
          ) : null}

          {/* Past-deadline read-only notice for the booking owner */}
          {!booking.capabilities.canCancel &&
            !booking.capabilities.canConfirm &&
            booking.capabilities.isOwnBooking &&
            booking.status !== 'cancelled' ? (
            <Button full variant="ghost" icon={CalendarX} disabled accessibilityLabel="Cancel Booking">
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
  reasonBox: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  reasonInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: typography.bodyFamily,
    fontSize: 14,
    minHeight: 72
  },
  reasonActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl
  }
});
