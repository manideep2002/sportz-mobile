import { StyleSheet, View, type DimensionValue } from 'react-native';

import { colors } from '@/design/tokens';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, max = 100, color = colors.orange[500], height = 4 }: ProgressBarProps) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%` as DimensionValue;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.dark[700],
    overflow: 'hidden'
  },
  fill: {
    height: '100%'
  }
});
