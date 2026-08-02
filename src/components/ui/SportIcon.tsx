import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/design/ThemeProvider';
import { radii, spacing, typography } from '@/design/tokens';
import type { Sport } from '@/types/domain';

const iconsBySport: Record<string, ImageSourcePropType> = {
  Cricket: require('../../../assets/sports-3d/cricket.png'),
  Football: require('../../../assets/sports-3d/football.png'),
  Kabaddi: require('../../../assets/sports-3d/kabaddi.png'),
  Badminton: require('../../../assets/sports-3d/badminton.png'),
  Hockey: require('../../../assets/sports-3d/hockey.png'),
  Athletics: require('../../../assets/sports-3d/athletics.png'),
  Running: require('../../../assets/sports-3d/running.png'),
  Basketball: require('../../../assets/sports-3d/basketball.png'),
  Volleyball: require('../../../assets/sports-3d/volleyball.png'),
  Tennis: require('../../../assets/sports-3d/tennis.png'),
  'Table Tennis': require('../../../assets/sports-3d/table-tennis.png'),
  Swimming: require('../../../assets/sports-3d/swimming.png'),
  Cycling: require('../../../assets/sports-3d/cycling.png')
};

interface SportIconProps {
  sport: Sport | string;
  size?: number;
}

export function SportIcon({ sport, size = 15 }: SportIconProps) {
  const source = iconsBySport[sport] ?? iconsBySport.Athletics;
  return (
    <Image
      accessibilityLabel={`${sport} sport`}
      resizeMode="contain"
      source={source}
      style={{ width: size, height: size }}
    />
  );
}

interface SportBadgeProps extends Pick<SportIconProps, 'sport'> {
  onPress?: () => void;
  selected?: boolean;
}

export function SportBadge({ sport, onPress, selected = true }: SportBadgeProps) {
  const { colors: theme } = useAppTheme();
  const badgeStyle = selected
    ? { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, color: theme.accent }
    : { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted };

  const badge = (
    <View
      accessibilityLabel={`${sport} sport${selected ? ' selected' : ''}`}
      style={[
        styles.badge,
        { backgroundColor: badgeStyle.backgroundColor, borderColor: badgeStyle.borderColor },
        !selected ? { opacity: 0.8 } : null
      ]}
    >
      <SportIcon sport={sport} size={14} />
      <AppText style={[styles.badgeText, { color: badgeStyle.color }]}>{sport}</AppText>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${sport} statistics`}
        onPress={onPress}
        style={({ pressed }) => [pressed ? { opacity: 0.75 } : null]}
      >
        {badge}
      </Pressable>
    );
  }

  return badge;
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
