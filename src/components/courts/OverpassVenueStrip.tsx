/**
 * OverpassVenueStrip — nearby public sports venues.
 *
 * Renders a horizontally-scrollable card strip of venues discovered via the
 * Overpass API.
 *
 * Tapping "Directions" opens the venue in the platform Maps app.
 */
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Globe, MapPin, Navigation, Wifi } from 'lucide-react-native';

import { AppText, Button } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { radii, spacing, typography } from '@/design/tokens';
import { useOverpassVenues } from '@/hooks/useCourts';
import type { CourtCoordinates } from '@/services/courtService';
import type { OverpassVenue } from '@/services/overpassService';
import type { Sport } from '@/types/domain';

// ── Props ───────────────────────────────────────────────────────────────────

export interface OverpassVenueStripProps {
  coordinates: CourtCoordinates | null;
  sport: Sport | 'All';
  radiusKm?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Opens the venue in the device's Maps application. */
async function openVenueInMaps(venue: OverpassVenue): Promise<void> {
  const { latitude: lat, longitude: lon, name } = venue;
  const label = encodeURIComponent(name);

  let url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  if (Platform.OS === 'ios') {
    url = `https://maps.apple.com/?q=${label}&ll=${lat},${lon}`;
  } else if (Platform.OS === 'android') {
    url = `geo:${lat},${lon}?q=${encodeURIComponent(name)}`;
  }

  const fallback = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : fallback);
  } catch {
    try {
      await Linking.openURL(fallback);
    } catch {
      Alert.alert('Could not open maps', 'Unable to open the maps application.');
    }
  }
}

/** Returns a human-readable label for the OSM sport tag. */
function sportLabel(sport: string | null): string {
  if (!sport) return 'Pitch';
  return sport.charAt(0).toUpperCase() + sport.slice(1).replace(/_/g, ' ');
}

// ── Component ───────────────────────────────────────────────────────────────

export function OverpassVenueStrip({
  coordinates,
  sport,
  radiusKm = 5,
}: OverpassVenueStripProps) {
  const { colors: theme } = useAppTheme();
  const { data: venues = [], isLoading, isError, refetch } = useOverpassVenues(
    coordinates,
    sport,
    radiusKm,
  );

  // ── No coordinates ────────────────────────────────────────────────────────

  if (!coordinates) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
            <Globe size={14} color={theme.accent} />
          </View>
          <AppText style={[styles.headerTitle, { color: theme.text }]}>
            Nearby public venues
          </AppText>
        </View>
        <View style={styles.emptyBody}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
            <Navigation size={18} color={theme.accent} />
          </View>
          <AppText style={[styles.emptyText, { color: theme.textSubtle }]}>
            Enable location permission to discover nearby public pitches.
          </AppText>
        </View>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
            <Globe size={14} color={theme.accent} />
          </View>
          <AppText style={[styles.headerTitle, { color: theme.text }]}>
            Nearby public venues
          </AppText>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.accent} size="small" />
          <AppText style={[styles.loadingText, { color: theme.textSubtle }]}>
            Searching nearby venues…
          </AppText>
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
            <Globe size={14} color={theme.accent} />
          </View>
          <AppText style={[styles.headerTitle, { color: theme.text }]}>
            Nearby public venues
          </AppText>
        </View>
        <View style={styles.emptyBody}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.dangerSoft }]}>
            <Wifi size={18} color={theme.danger} />
          </View>
          <View style={styles.emptyTextCol}>
<AppText style={[styles.emptyText, { color: theme.textSubtle }]}>
            Nearby venues unavailable — check your internet connection.
          </AppText>
            <Button size="sm" onPress={() => void refetch()}>
              Try again
            </Button>
          </View>
        </View>
      </View>
    );
  }

  // ── Empty results ─────────────────────────────────────────────────────────

  if (venues.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
            <Globe size={14} color={theme.accent} />
          </View>
          <AppText style={[styles.headerTitle, { color: theme.text }]}>
            Nearby public venues
          </AppText>
        </View>
        <View style={styles.emptyBody}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
            <MapPin size={18} color={theme.accent} />
          </View>
          <AppText style={[styles.emptyText, { color: theme.textSubtle }]}>
            No public pitches found within {radiusKm} km.
          </AppText>
        </View>
      </View>
    );
  }

  // ── Strip ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Nearby public venues"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
          <Globe size={14} color={theme.accent} />
        </View>
        <AppText style={[styles.headerTitle, { color: theme.text }]}>
          {venues.length} public venue{venues.length !== 1 ? 's' : ''} nearby
        </AppText>
      </View>

      {/* Venue cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        accessibilityLabel="Scrollable public venue cards"
      >
        {venues.map((venue) => (
          <VenueCard
            key={venue.osmId}
            venue={venue}
            theme={theme}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── VenueCard ────────────────────────────────────────────────────────────────

interface VenueCardProps {
  venue: OverpassVenue;
  theme: ReturnType<typeof useAppTheme>['colors'];
}

function VenueCard({ venue, theme }: VenueCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue.name} – tap to get directions`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
      onPress={() => void openVenueInMaps(venue)}
    >
      {/* Pin dot */}
      <View style={[styles.pinDot, { backgroundColor: theme.accent }]} />

      <AppText style={[styles.cardName, { color: theme.text }]} numberOfLines={2}>
        {venue.name}
      </AppText>

      {venue.sport ? (
        <View style={[styles.sportTag, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
          <AppText style={[styles.sportTagText, { color: theme.accent }]}>
            {sportLabel(venue.sport)}
          </AppText>
        </View>
      ) : null}

      {venue.distanceKm !== null ? (
        <AppText style={[styles.distance, { color: theme.textSubtle }]}>
          {venue.distanceKm.toFixed(1)} km away
        </AppText>
      ) : null}

      {venue.address ? (
        <AppText style={[styles.address, { color: theme.textSubtle }]} numberOfLines={1}>
          {venue.address}
        </AppText>
      ) : null}

      <View style={[styles.directionsRow, { borderTopColor: theme.border }]}>
        <Navigation size={10} color={theme.accent} />
        <AppText style={[styles.directionsLabel, { color: theme.accent }]}>
          Directions
        </AppText>
      </View>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 60,
  },
  loadingText: {
    fontSize: 12,
  },

  // Empty / error
  emptyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 60,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyTextCol: {
    flex: 1,
    gap: spacing.xs,
  },

  // Strip
  strip: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },

  // Venue card
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    minWidth: 130,
    maxWidth: 170,
    gap: 4,
  },
  pressed: {
    opacity: 0.75,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  cardName: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  sportTag: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginTop: 2,
  },
  sportTagText: {
    fontSize: 9,
    fontFamily: typography.bodyBold,
  },
  distance: {
    fontSize: 11,
    marginTop: 2,
  },
  address: {
    fontSize: 10,
  },
  directionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  directionsLabel: {
    fontSize: 10,
    fontFamily: typography.bodyBold,
  },
});
