import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { colors, radii, spacing, typography } from '@/design/tokens';

interface ChipProps extends Omit<PressableProps, 'style'> {
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ children, selected = false, style, ...props }: PropsWithChildren<ChipProps>) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null,
        style
      ]}
      {...props}
    >
      <AppText style={[styles.label, selected ? styles.selectedLabel : null]}>{children}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    marginRight: spacing.xs
  },
  selected: {
    backgroundColor: colors.orange[500],
    borderColor: colors.orange[500]
  },
  label: {
    color: colors.text.tertiary,
    fontFamily: typography.headingBold,
    fontSize: 13
  },
  selectedLabel: {
    color: colors.light[0]
  },
  pressed: {
    opacity: 0.8
  }
});
