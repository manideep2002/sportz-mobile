import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { colors, radii, spacing, typography } from '@/design/tokens';

type BadgeTone = 'orange' | 'dark' | 'green' | 'blue' | 'red' | 'yellow';

interface BadgeProps {
  tone?: BadgeTone;
  style?: ViewStyle;
}

const toneStyles: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  orange: { backgroundColor: colors.orange[500], color: colors.light[0] },
  dark: { backgroundColor: colors.dark[700], color: colors.text.secondary },
  green: { backgroundColor: colors.overlays.successSoft, color: colors.semantic.success },
  blue: { backgroundColor: colors.overlays.infoSoft, color: colors.semantic.info },
  red: { backgroundColor: colors.overlays.dangerSoft, color: colors.semantic.danger },
  yellow: { backgroundColor: 'rgba(245,158,11,0.15)', color: colors.semantic.warning }
};

export function Badge({ children, tone = 'dark', style }: PropsWithChildren<BadgeProps>) {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }, style]}>
      <AppText style={[styles.label, { color: toneStyle.color }]}>{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs
  },
  label: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 0.2
  }
});
