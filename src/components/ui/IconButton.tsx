import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, radii } from '@/design/tokens';
import { useAppTheme } from '@/design/ThemeProvider';

interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: LucideIcon;
  accessibilityLabel?: string;
  size?: number;
  iconSize?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon: Icon, accessibilityLabel, size = 40, iconSize = 18, color, filled = false, disabled, style, ...props }: IconButtonProps) {
  const theme = useAppTheme();
  const targetSize = Math.max(44, size);
  const inferredLabel = iconAccessibilityLabels[Icon.displayName ?? Icon.name] ?? 'Action';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? inferredLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          width: targetSize,
          height: targetSize,
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

const iconAccessibilityLabels: Record<string, string> = {
  ChevronLeft: 'Back',
  ChevronRight: 'Next',
  X: 'Close',
  Check: 'Approve',
  Send: 'Send message',
  Settings: 'Settings',
  MoreHorizontal: 'More options',
  MoreVertical: 'More options',
  Share2: 'Share',
  RefreshCw: 'Refresh',
  CalendarDays: 'Open calendar',
  Calendar: 'Choose date',
  CalendarX: 'Cancel booking',
  CalendarCheck: 'Bookings',
  Clock: 'Choose time',
  SlidersHorizontal: 'Filters',
  Plus: 'Add',
  Bell: 'Notifications',
  Bookmark: 'Saved posts',
  Camera: 'Camera',
  Edit3: 'Edit',
  HelpCircle: 'Help',
  ImageIcon: 'Add image',
  ImagePlus: 'Add media',
  LocateFixed: 'Use current location',
  Lock: 'Password',
  Mail: 'Email',
  MapPin: 'Open map',
  MessageCircle: 'Open chat',
  Phone: 'Phone number',
  Search: 'Search',
  UserPlus: 'Add member',
  Users: 'People',
  UserX: 'Block user',
  Trash2: 'Delete',
  UserMinus: 'Remove member',
  Shield: 'Change admin role',
  BarChart3: 'Stats',
  LogOut: 'Leave'
};
