import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CourtCard } from '@/components/courts/CourtCard';
import { CourtMapPreview } from '@/components/courts/CourtMapPreview';
import { AppText, Button, Chip, IconButton, Screen, SectionHeader } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useCourts } from '@/hooks/useCourts';
import type { AppStackParamList } from '@/navigation/routes';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const filters: Array<'All Sports' | Sport> = ['All Sports', 'Basketball', 'Football', 'Tennis', 'Badminton'];

export function CourtsScreen() {
  const navigation = useNavigation<Navigation>();
  const [filter, setFilter] = useState<'All Sports' | Sport>('All Sports');
  const { data: courts = [] } = useCourts(filter === 'All Sports' ? undefined : filter);

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h2">
          Courts<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <IconButton icon={SlidersHorizontal} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => (
          <Chip key={item} selected={item === filter} onPress={() => setFilter(item)}>
            {item}
          </Chip>
        ))}
      </ScrollView>
      <View style={styles.section}>
        <CourtMapPreview />
      </View>
      <View style={styles.section}>
        <SectionHeader title="Available Now" action={`${courts.filter((court) => court.availableNow).length} open`} />
        {courts.map((court) => (
          <CourtCard key={court.id} court={court} />
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
