import { StyleSheet, View } from 'react-native';
import { Award } from 'lucide-react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/design/ThemeProvider';
import { radii, typography } from '@/design/tokens';

interface SkillLevelBadgeProps {
  skillLevel?: string;
}

export function SkillLevelBadge({ skillLevel = 'Intermediate' }: SkillLevelBadgeProps) {
  const { colors: theme } = useAppTheme();
  const normalizedLevel = skillLevel.trim();
  const isPro = normalizedLevel.toLowerCase() === 'pro';

  if (isPro) {
    return (
      <View
        accessible
        accessibilityLabel="Pro Player Skill Level"
        style={[styles.proContainer, { backgroundColor: '#1E170A', borderColor: '#F59E0B' }]}
      >
        <Award size={13} color="#F59E0B" fill="#F59E0B" />
        <AppText style={styles.proText}>PRO ATHLETE</AppText>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`${normalizedLevel} Skill Level`}
      style={[styles.normalContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      <AppText style={[styles.normalText, { color: theme.textSubtle }]}>{normalizedLevel}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  proContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3
  },
  proText: {
    color: '#FBBF24',
    fontFamily: typography.headingBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  normalContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth
  },
  normalText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2
  }
});
