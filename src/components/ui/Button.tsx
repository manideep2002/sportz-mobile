import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { AppText } from './AppText';
import { colors, radii, shadows, spacing, typography } from '@/design/tokens';

type ButtonVariant = 'primary' | 'ghost' | 'dark' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  icon: Icon,
  disabled,
  style,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        full ? styles.full : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.light[0] : colors.orange[400]} /> : null}
      {!loading && Icon ? <Icon size={17} color={variant === 'primary' ? colors.light[0] : colors.orange[400]} strokeWidth={2.2} /> : null}
      <AppText style={[styles.label, variant === 'primary' ? styles.primaryLabel : null]}>{children}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.md
  },
  sm: {
    paddingHorizontal: 15,
    paddingVertical: 8
  },
  md: {
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  lg: {
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: radii.lg
  },
  primary: {
    backgroundColor: colors.orange[500],
    ...shadows.orangeGlow
  },
  ghost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.orange[400],
    backgroundColor: 'transparent'
  },
  dark: {
    backgroundColor: colors.dark[700]
  },
  danger: {
    backgroundColor: colors.overlays.dangerSoft
  },
  full: {
    width: '100%'
  },
  pressed: {
    opacity: 0.84
  },
  disabled: {
    opacity: 0.5
  },
  label: {
    color: colors.orange[400],
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  primaryLabel: {
    color: colors.light[0]
  }
});
