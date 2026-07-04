import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { colors, spacing, typography } from '@/design/tokens';
import type { UserProfile } from '@/types/domain';

type NameProfile = Pick<UserProfile, 'displayName' | 'skillLevel'>;
type AppTextVariant = ComponentProps<typeof AppText>['variant'];

interface VerifiedNameProps {
  profile: NameProfile;
  variant?: AppTextVariant;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  color?: string;
  numberOfLines?: number;
  badgeSize?: number;
}

export const shouldShowProVerifiedBadge = (profile: Pick<UserProfile, 'skillLevel'> | null | undefined) =>
  profile?.skillLevel === 'Pro';

export function VerifiedName({
  profile,
  variant = 'body',
  style,
  containerStyle,
  color,
  numberOfLines,
  badgeSize = 15
}: VerifiedNameProps) {
  const showBadge = shouldShowProVerifiedBadge(profile);
  const badgeHeight = Math.max(13, badgeSize);
  const badgeFontSize = Math.max(8, Math.round(badgeHeight * 0.5));
  const badgePadding = Math.max(5, Math.round(badgeHeight * 0.34));

  return (
    <View style={[styles.root, containerStyle]}>
      <AppText
        variant={variant}
        color={color}
        style={[style, styles.name]}
        numberOfLines={numberOfLines}
      >
        {profile.displayName}
      </AppText>
      {showBadge ? (
        <View
          accessible
          accessibilityLabel="Verified pro player"
          style={[
            styles.proBadge,
            {
              minHeight: badgeHeight,
              paddingHorizontal: badgePadding,
              borderRadius: badgeHeight / 2
            }
          ]}
        >
          <AppText style={[styles.proBadgeText, { fontSize: badgeFontSize, lineHeight: badgeHeight - 2 }]}>
            PRO
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    maxWidth: '100%'
  },
  name: {
    flexShrink: 1
  },
  proBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.46)',
    backgroundColor: 'rgba(245, 158, 11, 0.13)',
    shadowColor: colors.semantic.warning,
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  proBadgeText: {
    color: '#F8D77C',
    fontFamily: typography.bodyBold,
    includeFontPadding: false
  }
});
