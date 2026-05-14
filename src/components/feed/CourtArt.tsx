import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { colors, radii, typography } from '@/design/tokens';

interface CourtArtProps {
  statLine?: string;
}

export function CourtArt({ statLine }: CourtArtProps) {
  return (
    <View style={styles.wrap}>
      <Svg viewBox="0 0 340 160" width="100%" height="160">
        <Rect width="340" height="160" fill="#0A1A08" />
        <Rect x="20" y="10" width="300" height="140" rx="4" fill="none" stroke="#1a3a18" strokeWidth="1.5" />
        <Line x1="170" y1="10" x2="170" y2="150" stroke="#1a3a18" strokeWidth="1" />
        <Circle cx="170" cy="80" r="28" fill="none" stroke="#1a3a18" strokeWidth="1.2" />
        <Rect x="20" y="42" width="56" height="76" fill="none" stroke="#1a3a18" strokeWidth="1" />
        <Rect x="264" y="42" width="56" height="76" fill="none" stroke="#1a3a18" strokeWidth="1" />
        <Circle cx="56" cy="80" r="16" fill="none" stroke="rgba(255,90,31,0.5)" strokeWidth="1.5" />
        <Circle cx="284" cy="80" r="16" fill="none" stroke="rgba(255,90,31,0.5)" strokeWidth="1.5" />
        <Circle cx="165" cy="75" r="10" fill={colors.orange[500]} />
        <Path d="M159 73 Q165 69 171 73" stroke="#0A1A08" strokeWidth="1.2" fill="none" />
        <Path d="M159 77 Q165 81 171 77" stroke="#0A1A08" strokeWidth="1.2" fill="none" />
        <Line x1="165" y1="65" x2="165" y2="85" stroke="#0A1A08" strokeWidth="1.2" />
      </Svg>
      {statLine ? (
        <View style={styles.stat}>
          <AppText style={styles.statText}>{statLine}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 160,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#0A1A08'
  },
  stat: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(10,9,7,0.86)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statText: {
    color: colors.orange[500],
    fontFamily: typography.headingBold,
    fontSize: 12
  }
});
