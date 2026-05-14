import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/design/tokens';

type Variant = 'hero' | 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyMuted' | 'small' | 'caption';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
}

export function AppText({ variant = 'body', color, style, children, ...props }: PropsWithChildren<AppTextProps>) {
  return (
    <Text {...props} style={[styles.base, styles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text.primary,
    fontFamily: typography.bodyFamily
  },
  hero: {
    fontFamily: typography.headingBlack,
    fontSize: typography.sizes.hero,
    lineHeight: 62,
    color: colors.light[0]
  },
  h1: {
    fontFamily: typography.headingBlack,
    fontSize: typography.sizes.h1,
    lineHeight: 36
  },
  h2: {
    fontFamily: typography.headingFamily,
    fontSize: typography.sizes.h2,
    lineHeight: 30
  },
  h3: {
    fontFamily: typography.headingBold,
    fontSize: typography.sizes.h3,
    lineHeight: 23
  },
  h4: {
    fontFamily: typography.headingBold,
    fontSize: typography.sizes.h4,
    lineHeight: 19
  },
  body: {
    fontFamily: typography.bodyFamily,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.text.primary
  },
  bodyMuted: {
    fontFamily: typography.bodyFamily,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    color: colors.text.secondary
  },
  small: {
    fontFamily: typography.bodyFamily,
    fontSize: typography.sizes.small,
    color: colors.text.tertiary
  },
  caption: {
    fontFamily: typography.bodyBold,
    fontSize: typography.sizes.caption,
    color: colors.text.tertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  }
});
