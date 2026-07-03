import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CourtCard } from '@/components/courts/CourtCard';
import { CourtMapPreview } from '@/components/courts/CourtMapPreview';

import { AppRefreshControl, AppText, BottomSheet, Button, Chip, IconButton, Input, Screen, SectionHeader } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import { useCourts } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const filters: ('All Sports' | Sport)[] = ['All Sports', 'Basketball', 'Football', 'Tennis', 'Badminton'];

export function CourtsScreen() {
  const navigation = useNavigation<Navigation>();
  const [filter, setFilter] = useState<'All Sports' | Sport>('All Sports');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [city, setCity] = useState('');
  const [surface, setSurface] = useState<string | undefined>();
  const [maxPrice, setMaxPrice] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const { data: courts = [], isLoading, isError, isRefetching, refetch } = useCourts({
    sport: filter === 'All Sports' ? undefined : filter,
    city,
    surface,
    maxHourlyPrice: maxPrice ? Number(maxPrice) : undefined,
    availableOnly
  });

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
        <IconButton icon={SlidersHorizontal} onPress={() => setFilterSheetOpen(true)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => (
          <Chip key={item} selected={item === filter} onPress={() => setFilter(item)}>
            {item}
          </Chip>
        ))}
      </ScrollView>
      <View style={styles.section}>
        <CourtMapPreview court={courts[0]} />
      </View>
      <View style={styles.section}>
        <SectionHeader title="Available Now" action={`${courts.filter((court) => court.availableNow).length} open`} />
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
            {['Hard', 'Grass', 'Clay'].map((item) => (
              <Chip key={item} selected={surface === item} onPress={() => setSurface(surface === item ? undefined : item)}>{item}</Chip>
            ))}
          </View>
          <Input label="Max price per hour" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="500" />
          <Chip selected={availableOnly} onPress={() => setAvailableOnly((value) => !value)}>Available now</Chip>
          <Button full onPress={() => setFilterSheetOpen(false)}>Apply filters</Button>
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
  filters: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 14
  },
  section: {
    paddingHorizontal: spacing.screen,
    marginBottom: 22
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
