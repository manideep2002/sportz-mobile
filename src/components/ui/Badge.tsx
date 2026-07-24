import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';

type BadgeTone = 'orange' | 'dark' | 'green' | 'blue' | 'red' | 'yellow';

interface BadgeProps {
  tone?: BadgeTone;
  style?: ViewStyle;
}

export function Badge({ children, tone = 'dark', style }: PropsWithChildren<BadgeProps>) {
  const { colors: theme, isDark } = useAppTheme();
  const toneStyle =
    tone === 'orange'
      ? { backgroundColor: theme.accent, color: theme.onAccent }
      : tone === 'dark'
        ? { backgroundColor: theme.surfaceMuted, color: theme.textMuted }
        : tone === 'green'
          ? { backgroundColor: isDark ? colors.overlays.successSoft : '#DCFCE7', color: theme.success }
          : tone === 'blue'
            ? { backgroundColor: isDark ? colors.overlays.infoSoft : '#DBEAFE', color: theme.info }
            : tone === 'red'
              ? { backgroundColor: theme.dangerSoft, color: theme.danger }
              : { backgroundColor: theme.warningSoft, color: theme.warning };
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
