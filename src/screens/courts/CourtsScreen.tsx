import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, SlidersHorizontal } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CourtCard } from '@/components/courts/CourtCard';
import { CourtMapPreview } from '@/components/courts/CourtMapPreview';

import { AppRefreshControl, AppText, BottomSheet, Button, Chip, IconButton, Input, Screen, SectionHeader } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import { useCourtDiscoveryLocation, useCourts } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import { courtService, type CourtCoordinates } from '@/services/courtService';
import { useAuthStore } from '@/store/authStore';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const filters: ('All Sports' | Sport)[] = ['All Sports', 'Basketball', 'Football', 'Tennis', 'Badminton'];

export function CourtsScreen() {
  const navigation = useNavigation<Navigation>();
  const profileCity = useAuthStore((state) => state.profile?.city ?? '');
  const [filter, setFilter] = useState<'All Sports' | Sport>('All Sports');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [city, setCity] = useState(profileCity);
  const [appliedCity, setAppliedCity] = useState('');
  const [manualCoordinates, setManualCoordinates] = useState<CourtCoordinates | null>(null);
  const [resolvingCity, setResolvingCity] = useState(false);
  const [surface, setSurface] = useState<string | undefined>();
  const [maxPrice, setMaxPrice] = useState('');
  const [maxDistance, setMaxDistance] = useState('25');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [futureAvailabilityOnly, setFutureAvailabilityOnly] = useState(false);
  const location = useCourtDiscoveryLocation(profileCity);
  const coordinates = manualCoordinates ?? location.data?.coordinates ?? null;
  const fallbackCity = location.data?.status === 'granted' ? appliedCity : appliedCity || profileCity;
  const { data: courts = [], isLoading, isError, isRefetching, refetch } = useCourts({
    sport: filter === 'All Sports' ? undefined : filter,
    city: fallbackCity,
    surface,
    maxHourlyPrice: maxPrice ? Number(maxPrice) : undefined,
    maxDistanceKm: maxDistance ? Number(maxDistance) : undefined,
    openNowOnly,
    futureAvailabilityOnly,
    coordinates
  });

  const applyFilters = async () => {
    const normalizedCity = city.trim();
    setResolvingCity(true);
    try {
      if (normalizedCity && location.data?.status !== 'granted') {
        setManualCoordinates(await courtService.geocodeDiscoveryCity(normalizedCity));
      } else if (!normalizedCity) {
        setManualCoordinates(null);
      }
      setAppliedCity(normalizedCity);
      setFilterSheetOpen(false);
    } finally {
      setResolvingCity(false);
    }
  };

  const locationMessage = location.isLoading
    ? 'Finding your location…'
    : location.data?.status === 'granted'
      ? 'Distances are measured from your current location.'
      : coordinates
        ? `Location permission unavailable. Distances use ${appliedCity || profileCity}.`
        : 'Location permission unavailable. Showing city matches without estimated distance.';

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
        <AppText variant="h2">
          Courts<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <View style={styles.headerActions}>
          <IconButton
            icon={CalendarDays}
            accessibilityLabel="My Bookings"
            onPress={() => navigation.navigate('CourtBookings')}
          />
          <IconButton
            icon={SlidersHorizontal}
            accessibilityLabel="Court filters"
            onPress={() => setFilterSheetOpen(true)}
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => (
          <Chip key={item} selected={item === filter} onPress={() => setFilter(item)}>
            {item}
          </Chip>
        ))}
      </ScrollView>
      <View style={styles.locationState}>
        <AppText variant="small">{locationMessage}</AppText>
      </View>
      <View style={styles.section}>
        <CourtMapPreview court={courts[0]} />
      </View>
      <View style={styles.section}>
        <SectionHeader title="Court discovery" action={`${courts.filter((court) => court.openNow).length} open now`} />
        {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {isError ? (
          <View style={styles.empty}>
            <AppText variant="bodyMuted">Could not load courts.</AppText>
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          </View>
        ) : null}
        {!isLoading && !isError && courts.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.emptyText}>No courts match these filters.</AppText>
        ) : null}
        {courts.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            onPress={() => navigation.navigate('CourtDetail', { courtId: court.id })}
            onBook={() => navigation.navigate('CourtBooking', { courtId: court.id })}
          />
        ))}
      </View>
      <View style={styles.section}>
        <View style={styles.hire}>
          <AppText variant="caption" color={colors.orange[300]}>Team Building</AppText>
          <AppText variant="h3" style={styles.hireTitle}>Hire Athletes for Your Squad</AppText>
          <AppText variant="bodyMuted">Browse verified athletes by sport, skill and availability.</AppText>
          <Button full style={styles.hireButton} onPress={() => navigation.navigate('FindPlayers')}>
            Browse Athletes
          </Button>
        </View>
      </View>
      <BottomSheet open={filterSheetOpen} title="Court filters" onClose={() => setFilterSheetOpen(false)}>
        <View style={styles.sheetContent}>
          <Input label="City" value={city} onChangeText={setCity} placeholder="Bengaluru" />
          <AppText style={styles.label}>Surface</AppText>
          <View style={styles.wrapRow}>
            {['Hardwood', 'Synthetic floor', 'Clay surface', 'Astroturf'].map((item) => (
              <Chip key={item} selected={surface === item} onPress={() => setSurface(surface === item ? undefined : item)}>{item}</Chip>
            ))}
          </View>
          <Input label="Max price per hour" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="500" />
          <Input
            label="Maximum distance (km)"
            value={maxDistance}
            onChangeText={setMaxDistance}
            keyboardType="numeric"
            placeholder="25"
          />
          <View style={styles.wrapRow}>
            <Chip selected={openNowOnly} onPress={() => setOpenNowOnly((value) => !value)}>Open now</Chip>
            <Chip
              selected={futureAvailabilityOnly}
              onPress={() => setFutureAvailabilityOnly((value) => !value)}
            >
              Bookable this week
            </Chip>
          </View>
          <Button full loading={resolvingCity} onPress={() => void applyFilters()}>Apply filters</Button>
        </View>
      </BottomSheet>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  filters: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 14
  },
  section: {
    paddingHorizontal: spacing.screen,
    marginBottom: 22
  },
  locationState: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.dark[800],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.lg
  },
  hire: {
    backgroundColor: '#1A0800',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.overlays.orangeBorder,
    padding: 18,
    gap: spacing.xs
  },
  hireTitle: {
    fontSize: 20,
    lineHeight: 23
  },
  hireButton: {
    marginTop: spacing.sm
  }
});
