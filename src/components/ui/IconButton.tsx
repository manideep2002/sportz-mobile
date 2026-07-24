import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, radii } from '@/design/tokens';
import { useAppTheme } from '@/design/ThemeProvider';

interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: LucideIcon;
  size?: number;
  iconSize?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon: Icon, size = 40, iconSize = 18, color, filled = false, disabled, style, ...props }: IconButtonProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: filled ? radii.lg : radii.md,
          backgroundColor: filled ? theme.colors.accent : theme.colors.surface,
          borderColor: theme.colors.border
        },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style
      ]}
      {...props}
    >
      <Icon size={iconSize} color={filled ? theme.colors.onAccent : color ?? theme.colors.text} strokeWidth={2.1} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  pressed: {
    opacity: 0.78
  },
  disabled: {
    opacity: 0.5
  }
});
