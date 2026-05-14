import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { AppText } from './AppText';
import { colors, radii, spacing, typography } from '@/design/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: LucideIcon;
}

export const Input = forwardRef<TextInput, InputProps>(({ label, icon: Icon, style, ...props }, ref) => (
  <View style={styles.group}>
    {label ? <AppText style={styles.label}>{label}</AppText> : null}
    <View style={styles.wrap}>
      {Icon ? <Icon size={17} color={colors.text.tertiary} strokeWidth={2} style={styles.icon} /> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.text.tertiary}
        selectionColor={colors.orange[400]}
        style={[styles.input, Icon ? styles.withIcon : null, style]}
        {...props}
      />
    </View>
  </View>
));

Input.displayName = 'Input';

const styles = StyleSheet.create({
  group: {
    gap: 6
  },
  label: {
    color: colors.text.tertiary,
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  wrap: {
    position: 'relative'
  },
  icon: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 1
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: typography.bodyFamily,
    fontSize: 14
  },
  withIcon: {
    paddingLeft: 44
  }
});
