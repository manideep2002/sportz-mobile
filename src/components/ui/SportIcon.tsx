import {
  Bike,
  CircleDot,
  Goal,
  PersonStanding,
  Trophy,
  Waves,
  type LucideIcon
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/design/ThemeProvider';
import { radii, spacing, typography } from '@/design/tokens';
import type { Sport } from '@/types/domain';

const iconsBySport: Partial<Record<Sport, LucideIcon>> = {
  Football: Goal,
  Athletics: PersonStanding,
  Running: PersonStanding,
  Swimming: Waves,
  Cycling: Bike,
  Cricket: CircleDot,
  Badminton: CircleDot,
  Basketball: CircleDot,
  Volleyball: CircleDot,
  Tennis: CircleDot,
  'Table Tennis': CircleDot
};

interface SportIconProps {
  sport: Sport | string;
  color?: string;
  size?: number;
}

export function SportIcon({ sport, color, size = 13 }: SportIconProps) {
  const { colors: theme } = useAppTheme();
  const Icon = iconsBySport[sport as Sport] ?? Trophy;
  return <Icon accessibilityLabel={`${sport} sport`} size={size} color={color ?? theme.accent} strokeWidth={2} />;
}

export function SportBadge({ sport }: Pick<SportIconProps, 'sport'>) {
  const { colors: theme } = useAppTheme();
  return (
    <View
      accessibilityLabel={`${sport} sport`}
      style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}
    >
      <SportIcon sport={sport} size={11} />
      <AppText style={[styles.badgeText, { color: theme.accent }]}>{sport}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  badgeText: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 0.2
  }
});
