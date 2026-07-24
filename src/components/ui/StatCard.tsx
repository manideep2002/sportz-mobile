import { StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing } from '@/design/tokens';

interface StatCardProps {
  value: string | number;
  label: string;
  tone?: 'orange' | 'green' | 'plain';
  style?: StyleProp<ViewStyle>;
}

export function StatCard({ value, label, tone = 'plain', style }: StatCardProps) {
  const { colors: theme } = useAppTheme();
  const color = tone === 'orange' ? theme.accent : tone === 'green' ? colors.semantic.success : theme.text;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <AppText variant="h2" color={color} style={styles.value}>
        {value}
      </AppText>
      <AppText variant="small">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  value: {
    fontSize: 22,
    lineHeight: 25
  }
});
