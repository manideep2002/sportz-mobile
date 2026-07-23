import { useMemo, useState } from 'react';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { CalendarCheck, ChevronLeft } from 'lucide-react-native';

import {
  AppRefreshControl,
  AppText,
  Avatar,
  Badge,
  Button,
  Chip,
  IconButton,
  Screen,
  VerifiedName
} from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import {
  useAdminCourtBookings,
  useMyCourtBookings,
  useUpdateCourtBookingStatus
} from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import type { CourtBooking } from '@/types/domain';
import {
  bookingMatchesFilter,
  formatCourtDate,
  formatCourtTime,
  type CourtBookingFilter
} from '@/utils/courtTime';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtBookings'>;

const filters: { key: CourtBookingFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'past', label: 'Past' }
];

const statusTone = (status: CourtBooking['status']) => {
  if (status === 'confirmed') return 'green' as const;
  if (status === 'cancelled') return 'red' as const;
  return 'orange' as const;
};

export function CourtBookingsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const profile = useAuthStore((state) => state.profile);
  const adminMode = Boolean(route.params?.admin && profile?.isAdmin);
  const courtId = adminMode ? route.params?.courtId : undefined;
  const myBookings = useMyCourtBookings(!adminMode);
  const adminBookings = useAdminCourtBookings(courtId, adminMode);
  const query = adminMode ? adminBookings : myBookings;
  const updateStatus = useUpdateCourtBookingStatus(courtId);
  const [filter, setFilter] = useState<CourtBookingFilter>('upcoming');
  const visibleBookings = useMemo(
    () => adminMode
      ? query.data ?? []
      : (query.data ?? []).filter((booking) => bookingMatchesFilter(booking, filter)),
    [adminMode, filter, query.data]
  );

  const setStatus = async (
    booking: CourtBooking,
    status: Extract<CourtBooking['status'], 'confirmed' | 'cancelled'>
  ) => {
    try {
      await updateStatus.mutateAsync({ bookingId: booking.id, status });
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">{adminMode ? 'Manage Bookings' : 'My Bookings'}</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {!adminMode ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((item) => (
            <Chip key={item.key} selected={filter === item.key} onPress={() => setFilter(item.key)}>
              {item.label}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      {query.isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {query.isError ? (
        <View style={styles.empty}>
          <AppText variant="bodyMuted">
            {query.error instanceof Error ? query.error.message : 'Could not load court bookings.'}
          </AppText>
          <Button size="sm" onPress={() => void query.refetch()}>Retry</Button>
        </View>
      ) : null}

      {!query.isLoading && !query.isError && visibleBookings.length === 0 ? (
        <View style={styles.empty}>
          <CalendarCheck size={42} color={colors.text.tertiary} />
          <AppText variant="h4">{adminMode ? 'No booking requests' : `No ${filter} bookings`}</AppText>
          <AppText variant="bodyMuted">
            {adminMode
              ? 'Booking requests for this scope will appear here.'
              : 'Book a court and track its status here.'}
          </AppText>
          {!adminMode ? <Button size="sm" onPress={() => navigation.navigate('Courts')}>Find Courts</Button> : null}
        </View>
      ) : null}

      {visibleBookings.map((booking) => (
        <View key={booking.id} style={styles.booking}>
          <View style={styles.topRow}>
            <View style={styles.flex}>
              <AppText style={styles.courtName}>{booking.court.name}</AppText>
              <AppText variant="small">{booking.court.city} · {booking.court.sport}</AppText>
            </View>
            <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
          </View>
          {adminMode ? (
            <View style={styles.userRow}>
              <Avatar initials={booking.user.initials} uri={booking.user.avatarUrl} size={36} />
              <VerifiedName profile={booking.user} style={styles.userName} numberOfLines={1} />
            </View>
          ) : null}
          <AppText variant="small">
            {formatCourtDate(booking.startsAt, booking.court.timezone)}
            {' · '}
            {formatCourtTime(booking.startsAt, booking.court.timezone)}
            {' – '}
            {formatCourtTime(booking.endsAt, booking.court.timezone)}
          </AppText>
          <View style={styles.actions}>
            <Button
              size="sm"
              variant="dark"
              onPress={() => navigation.navigate('CourtBookingDetail', {
                bookingId: booking.id,
                admin: adminMode
              })}
            >
              View Details
            </Button>
            {adminMode && booking.status === 'pending' ? (
              <>
                <Button
                  size="sm"
                  loading={updateStatus.isPending}
                  onPress={() => void setStatus(booking, 'confirmed')}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={updateStatus.isPending}
                  onPress={() => void setStatus(booking, 'cancelled')}
                >
                  Cancel
                </Button>
              </>
            ) : null}
          </View>
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
  filters: {
    gap: spacing.xs
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
  flex: {
    flex: 1
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
    flex: 1,
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm
  }
});
