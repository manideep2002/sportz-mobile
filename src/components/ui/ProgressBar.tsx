import { StyleSheet, View, type DimensionValue } from 'react-native';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors } from '@/design/tokens';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, max = 100, color, height = 4 }: ProgressBarProps) {
  const { colors: theme } = useAppTheme();
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%` as DimensionValue;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.fill, { width, backgroundColor: color ?? theme.accent, borderRadius: height / 2 }]} />
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
