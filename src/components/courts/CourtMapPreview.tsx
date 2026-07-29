/**
 * CourtMapPreview — multi-court discovery strip.
 *
 * Renders a horizontally scrollable row of "pin cards" (one per court that has
 * valid, non-zero coordinates).  Selecting a pin calls `onSelect` so the parent
 * can synchronise the results list.  Tapping "Open in Maps" deep-links the
 * selected court via the platform Maps application.
 *
 * No native MapView SDK is used intentionally: react-native-maps requires API
 * keys and a native rebuild.  Behaviour matches the documented "court discovery
 * map preview" scope while remaining testable in JS-only environments.
 */
import { useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';

import { AppText, Button } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { Court } from '@/types/domain';
import { openCourtInMaps } from '@/utils/maps';

// ── helpers ────────────────────────────────────────────────────────────────

/** Returns true when a court has usable coordinates (non-zero, finite). */
function hasValidCoords(court: Court): boolean {
  return (
    Number.isFinite(court.latitude) &&
    Number.isFinite(court.longitude) &&
    (court.latitude !== 0 || court.longitude !== 0)
  );
}

// ── props ──────────────────────────────────────────────────────────────────

/**
 * Subset of CourtLocationResult['status'] — inlined here to avoid importing
 * courtService (which has expo-location as a side effect) in UI components.
 */
export type CourtLocationStatus = 'granted' | 'fallback' | 'denied' | 'unavailable';

export interface CourtMapPreviewProps {
  courts?: Court[];
  selectedId?: string;
  onSelect?: (courtId: string) => void;
  locationStatus?: CourtLocationStatus;
  isLoading?: boolean;
}

// ── component ──────────────────────────────────────────────────────────────

export function CourtMapPreview({
  courts = [],
  selectedId,
  onSelect,
  locationStatus,
  isLoading = false
}: CourtMapPreviewProps) {
  const { colors: theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Only expose courts that can be meaningfully shown on a map.
  const mappableCourts = courts.filter(hasValidCoords);

  // Resolved selected court — fall back to first mappable court when no explicit
  // selection has been made yet.
  const activeCourt =
    mappableCourts.find((c) => c.id === selectedId) ?? mappableCourts[0] ?? null;

  // ── loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessibilityLabel="Loading court locations"
        accessibilityLiveRegion="polite"
      >
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.accent} />
          <AppText variant="small" style={{ color: theme.textSubtle }}>
            Loading court locations…
          </AppText>
        </View>
      </View>
    );
  }

  // ── empty / no-valid-coords state ─────────────────────────────────────────

  if (mappableCourts.length === 0) {
    const message =
      courts.length === 0
        ? 'No courts match these filters.'
        : 'No courts with map locations in this area.';

    return (
      <View
        style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessibilityLabel={message}
      >
        {locationStatus === 'denied' || locationStatus === 'unavailable' ? (
          <PermissionBanner theme={theme} />
        ) : null}
        <View style={styles.emptyBody}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
            <MapPin size={22} color={theme.accent} />
          </View>
          <AppText variant="small" style={[styles.emptyText, { color: theme.textSubtle }]}>
            {message}
          </AppText>
        </View>
      </View>
    );
  }

  // ── main strip ────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Court locations"
    >
      {/* Permission-denied notice — shown above the strip when location is unavailable */}
      {locationStatus === 'denied' || locationStatus === 'unavailable' ? (
        <PermissionBanner theme={theme} />
      ) : null}

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
          <MapPin size={14} color={theme.accent} />
        </View>
        <AppText style={[styles.headerTitle, { color: theme.text }]}>
          {mappableCourts.length} court{mappableCourts.length !== 1 ? 's' : ''} on the map
        </AppText>
      </View>

      {/* Pin-card strip */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        accessibilityLabel="Scrollable court pin cards"
      >
        {mappableCourts.map((court) => {
          const selected = court.id === activeCourt?.id;
          return (
            <PinCard
              key={court.id}
              court={court}
              selected={selected}
              theme={theme}
              onSelect={onSelect}
            />
          );
        })}
      </ScrollView>

      {/* Open in Maps action for the active court */}
      {activeCourt ? (
        <View style={styles.actionRow}>
          <View style={styles.actionMeta}>
            <Navigation size={12} color={theme.accent} />
            <AppText
              style={[styles.actionLabel, { color: theme.textSubtle }]}
              numberOfLines={1}
            >
              {activeCourt.name}
              {activeCourt.city ? ` · ${activeCourt.city}` : ''}
            </AppText>
          </View>
          <Button
            size="sm"
            accessibilityLabel={`Open ${activeCourt.name} in Maps`}
            onPress={() => void openCourtInMaps(activeCourt)}
          >
            Open in Maps
          </Button>
        </View>
      ) : null}
    </View>
  );
}

// ── PinCard ────────────────────────────────────────────────────────────────

interface PinCardProps {
  court: Court;
  selected: boolean;
  theme: ReturnType<typeof useAppTheme>['colors'];
  onSelect?: (id: string) => void;
}

function PinCard({ court, selected, theme, onSelect }: PinCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={court.name}
      accessibilityHint={`Latitude ${court.latitude.toFixed(4)}, longitude ${court.longitude.toFixed(4)}`}
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect?.(court.id)}
      style={({ pressed }) => [
        styles.pinCard,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surfaceElevated,
          borderColor: selected ? theme.accent : theme.border
        },
        pressed ? styles.pressed : null
      ]}
    >
      {/* Pin dot */}
      <View
        style={[
          styles.pinDot,
          { backgroundColor: selected ? theme.accent : theme.textSubtle }
        ]}
      />

      <AppText
        style={[styles.pinName, { color: selected ? theme.accent : theme.text }]}
        numberOfLines={1}
      >
        {court.name}
      </AppText>

      {court.distanceKm !== null ? (
        <AppText style={[styles.pinDistance, { color: theme.textSubtle }]}>
          {court.distanceKm.toFixed(1)} km
        </AppText>
      ) : null}

      <AppText style={[styles.pinCoords, { color: theme.textSubtle }]}>
        {court.latitude.toFixed(3)},{court.longitude.toFixed(3)}
      </AppText>
    </Pressable>
  );
}

// ── PermissionBanner ───────────────────────────────────────────────────────

interface BannerProps {
  theme: ReturnType<typeof useAppTheme>['colors'];
}

function PermissionBanner({ theme }: BannerProps) {
  return (
    <View style={[styles.permissionBanner, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Navigation size={12} color={theme.textSubtle} />
      <AppText style={[styles.permissionText, { color: theme.textSubtle }]}>
        Location permission unavailable — distances may not reflect your position.
      </AppText>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    overflow: 'hidden'
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 64
  },

  // Empty
  emptyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 64
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft
  },
  emptyText: {
    flex: 1,
    color: colors.text.tertiary
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft
  },
  headerTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.text.primary
  },

  // Strip
  strip: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs
  },

  // Pin card
  pinCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    padding: spacing.sm,
    minWidth: 110,
    maxWidth: 150,
    gap: 3
  },
  pressed: {
    opacity: 0.78
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.tertiary,
    marginBottom: 2
  },
  pinName: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.text.primary
  },
  pinDistance: {
    fontSize: 11,
    color: colors.text.secondary
  },
  pinCoords: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontFamily: typography.bodyFamily
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark[700],
    gap: spacing.sm
  },
  actionMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  actionLabel: {
    flex: 1,
    fontSize: 11,
    color: colors.text.secondary
  },

  // Permission banner
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  permissionText: {
    flex: 1,
    fontSize: 10,
    color: colors.text.tertiary
  }
});
