import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { Court } from '@/types/domain';
import { currency } from '@/utils/format';

interface CourtCardProps {
  court: Court;
  onBook?: () => void;
  onPress?: () => void;
}

export function CourtCard({ court, onBook, onPress }: CourtCardProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${court.name}`} onPress={onPress}>
      <Card style={[styles.card, !court.availableNow ? styles.disabled : null]}>
        <View style={styles.sportIcon}>
          <AppText variant="h2">{court.sport.slice(0, 1)}</AppText>
        </View>
        <View style={styles.meta}>
          <AppText style={styles.name}>{court.name}</AppText>
          <AppText variant="small">
            {court.distanceKm} km - {court.surface} - {court.rating.toFixed(1)}
          </AppText>
          <View style={styles.priceRow}>
            <AppText style={[styles.price, !court.availableNow ? styles.mutedPrice : null]}>
              {currency(court.hourlyPrice, court.currency)}
              <AppText variant="small">/hr</AppText>
            </AppText>
            <Badge tone={court.availableNow ? 'green' : 'red'}>{court.availabilityLabel}</Badge>
          </View>
        </View>
        <Button
          variant={court.availableNow ? 'primary' : 'dark'}
          size="sm"
          onPress={(event) => {
            event.stopPropagation();
            onBook?.();
          }}
        >
          {court.availableNow ? 'Book' : 'Notify'}
        </Button>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  disabled: {
    opacity: 0.55
  },
  sportIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#0A1A08',
    alignItems: 'center',
    justifyContent: 'center'
  },
  meta: {
    flex: 1,
    gap: 4
  },
  name: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2
  },
  price: {
    color: colors.orange[500],
    fontFamily: typography.headingBold,
    fontSize: 17
  },
  mutedPrice: {
    color: colors.text.tertiary
  }
});
