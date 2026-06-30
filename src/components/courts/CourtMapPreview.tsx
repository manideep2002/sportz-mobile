import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { colors, radii, typography } from '@/design/tokens';
import type { Court } from '@/types/domain';

export function CourtMapPreview({ court }: { court?: Court }) {
  const openMaps = () => {
    if (!court) return;
    const query = encodeURIComponent(`${court.latitude},${court.longitude}`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <View style={styles.map}>
      <Svg viewBox="0 0 350 160" width="100%" height="160">
        <Rect width="350" height="160" fill="#0F1420" />
        {[40, 80, 120].map((y) => (
          <Line key={`h-${y}`} x1="0" y1={y} x2="350" y2={y} stroke="#1a2030" strokeWidth="10" />
        ))}
        {[88, 175, 262].map((x) => (
          <Line key={`v-${x}`} x1={x} y1="0" x2={x} y2="160" stroke="#1a2030" strokeWidth="10" />
        ))}
        <Rect x="8" y="48" width="72" height="24" rx="3" fill="#141822" />
        <Rect x="96" y="8" width="72" height="24" rx="3" fill="#141822" />
        <Rect x="96" y="88" width="72" height="24" rx="3" fill="#141822" />
        <Rect x="183" y="48" width="72" height="64" rx="3" fill="#141822" />
        <Rect x="270" y="8" width="72" height="64" rx="3" fill="#141822" />
        <Circle cx="140" cy="80" r="11" fill={colors.orange[500]} />
        <Circle cx="140" cy="80" r="4" fill="white" />
        <Circle cx="140" cy="80" r="19" fill="none" stroke={colors.orange[500]} strokeWidth="1.5" opacity="0.4" />
        <Circle cx="220" cy="45" r="10" fill={colors.orange[400]} opacity="0.9" />
        <Circle cx="220" cy="45" r="4" fill="white" />
        <Circle cx="72" cy="120" r="9" fill={colors.semantic.success} opacity="0.8" />
        <Circle cx="72" cy="120" r="3.5" fill="white" />
      </Svg>
      <View style={styles.count}>
        <AppText style={styles.countText}>{court?.name ?? 'Court location'}</AppText>
      </View>
      <Pressable style={styles.expand} onPress={openMaps} disabled={!court}>
        <AppText style={styles.expandText}>View on Maps</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 160,
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800]
  },
  count: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(14,12,9,0.9)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  countText: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 11
  },
  expand: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: colors.orange[500],
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  expandText: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 12
  }
});
