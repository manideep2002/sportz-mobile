import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { SportEvent } from '@/types/domain';

interface LiveMatchBannerProps {
  event: SportEvent;
  onPress: () => void;
}

export function LiveMatchBanner({ event, onPress }: LiveMatchBannerProps) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.glow} />
        <View style={styles.top}>
          <View>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <AppText style={styles.liveText}>LIVE NOW</AppText>
            </View>
            <AppText variant="h3">{event.title}</AppText>
            <AppText variant="small">{event.locationName} - 3.2 km</AppText>
          </View>
          <View style={styles.scoreBox}>
            <AppText style={styles.score}>2-1</AppText>
            <AppText variant="small">42 MIN</AppText>
          </View>
        </View>
        <View style={styles.bottom}>
          <View style={styles.stack}>
            {event.attendees.slice(0, 3).map((user, index) => (
              <View key={user.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                <Avatar initials={user.initials} size={26} tone={index === 0 ? 'orange' : index === 1 ? 'green' : 'blue'} />
              </View>
            ))}
          </View>
          <AppText variant="small">+7 watching</AppText>
          <Button size="sm" style={styles.watch}>
            Watch
          </Button>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: '#180800',
    borderColor: colors.overlays.orangeBorder
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -30,
    top: -30,
    backgroundColor: 'rgba(255,90,31,0.07)'
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.semantic.danger
  },
  liveText: {
    color: colors.semantic.danger,
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5
  },
  scoreBox: {
    alignItems: 'center'
  },
  score: {
    color: colors.light[0],
    fontFamily: typography.headingBlack,
    fontSize: 32,
    letterSpacing: 2
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 12
  },
  stack: {
    flexDirection: 'row'
  },
  watch: {
    marginLeft: 'auto',
    borderRadius: 8
  }
});
