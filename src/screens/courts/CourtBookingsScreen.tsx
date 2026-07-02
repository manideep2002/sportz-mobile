import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { CalendarCheck, ChevronLeft } from 'lucide-react-native';

import { AppText, Avatar, Badge, Button, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useCourtBookings, useUpdateCourtBookingStatus } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import type { CourtBooking } from '@/types/domain';
import { eventDate, formatTime } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtBookings'>;

const statusTone = (status: CourtBooking['status']) => {
  if (status === 'confirmed') return 'green' as const;
  if (status === 'cancelled') return 'red' as const;
  return 'orange' as const;
};

export function CourtBookingsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const courtId = route.params?.courtId;
  const { data: bookings = [], isLoading } = useCourtBookings(courtId);
  const updateStatus = useUpdateCourtBookingStatus(courtId);

  const setStatus = async (booking: CourtBooking, status: CourtBooking['status']) => {
    try {
      await updateStatus.mutateAsync({ bookingId: booking.id, status });
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Court Bookings</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}

      {!isLoading && bookings.length === 0 ? (
        <View style={styles.empty}>
          <CalendarCheck size={42} color={colors.text.tertiary} />
          <AppText variant="h4">No bookings</AppText>
          <AppText variant="bodyMuted">Court requests will appear here.</AppText>
        </View>
      ) : null}

      {bookings.map((booking) => (
        <View key={booking.id} style={styles.booking}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.courtName}>{booking.court.name}</AppText>
              <AppText variant="small">{booking.court.city} - {booking.court.sport}</AppText>
            </View>
            <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
          </View>
          <View style={styles.userRow}>
            <Avatar initials={booking.user.initials} uri={booking.user.avatarUrl} size={36} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.userName}>{booking.user.displayName}</AppText>
              <AppText variant="small">{eventDate(booking.startsAt)} - {formatTime(booking.startsAt)} to {formatTime(booking.endsAt)}</AppText>
            </View>
          </View>
          {booking.status === 'pending' ? (
            <View style={styles.actions}>
              <Button size="sm" loading={updateStatus.isPending} onPress={() => void setStatus(booking, 'confirmed')}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" disabled={updateStatus.isPending} onPress={() => void setStatus(booking, 'cancelled')}>
                Cancel
              </Button>
            </View>
          ) : null}
        </View>
      ))}
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
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  booking: {
    gap: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  courtName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 15
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  userName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm
  }
});
