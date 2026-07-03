import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ChevronLeft, MapPin } from 'lucide-react-native';

import { CourtMapPreview } from '@/components/courts/CourtMapPreview';
import { AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useCourt } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { currency } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CourtDetail'>;

export function CourtDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: court, isLoading, isError, refetch } = useCourt(route.params.courtId);
  const profile = useAuthStore((state) => state.profile);

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Court</AppText>
        <View style={{ width: 40 }} />
      </View>
      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {isError ? (
        <View style={styles.empty}>
          <AppText variant="bodyMuted">Could not load this court.</AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}
      {!isLoading && !isError && !court ? (
        <View style={styles.empty}>
          <AppText variant="h4">Court not found</AppText>
          <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      ) : null}
      {court ? (
        <>
          <CourtMapPreview court={court} />
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="h2">{court.name}</AppText>
              <AppText variant="bodyMuted">{court.city}</AppText>
            </View>
            <Badge tone={court.availableNow ? 'green' : 'red'}>{court.availabilityLabel}</Badge>
          </View>
          <View style={styles.metaCard}>
            <Meta label="Sport" value={court.sport} />
            <Meta label="Surface" value={court.surface} />
            <Meta label="Rating" value={court.rating.toFixed(1)} />
            <Meta label="Price" value={`${currency(court.hourlyPrice, court.currency)}/hr`} />
          </View>
          <Button
            full
            size="lg"
            icon={MapPin}
            disabled={!court.availableNow}
            onPress={() => navigation.navigate('CourtBooking', { courtId: court.id })}
          >
            {court.availableNow ? 'Book Court' : 'Court Unavailable'}
          </Button>
          {profile?.isAdmin ? (
            <Button full size="lg" variant="dark" onPress={() => navigation.navigate('CourtBookings', { courtId: court.id })}>
              Manage Bookings
            </Button>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <AppText variant="small">{label}</AppText>
      <AppText style={styles.metaValue}>{value}</AppText>
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
  titleRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
  },
  metaCard: {
    backgroundColor: colors.dark[800],
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md,
    gap: spacing.sm
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metaValue: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold
  }
});
