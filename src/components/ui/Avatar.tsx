import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, typography } from '@/design/tokens';

type AvatarTone = 'orange' | 'green' | 'blue' | 'pink' | 'yellow' | 'dark';

interface AvatarProps {
  initials: string;
  size?: number;
  tone?: AvatarTone;
  online?: boolean;
}

const gradients: Record<AvatarTone, [string, string]> = {
  orange: [colors.orange[500], colors.orange[600]],
  green: [colors.semantic.success, colors.semantic.successDark],
  blue: [colors.semantic.info, '#1D4ED8'],
  pink: ['#EC4899', '#9333EA'],
  yellow: [colors.semantic.warning, '#D97706'],
  dark: [colors.dark[700], colors.dark[600]]
};

export function Avatar({ initials, size = 42, tone = 'orange', online = false }: AvatarProps) {
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient colors={gradients[tone]} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <AppText style={[styles.initials, { fontSize: Math.max(10, size * 0.34) }]}>{initials}</AppText>
      </LinearGradient>
      {online ? <View style={[styles.online, { width: size * 0.24, height: size * 0.24, borderRadius: size * 0.12 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  initials: {
    color: colors.light[0],
    fontFamily: typography.headingFamily
  },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.semantic.success,
    borderWidth: 2,
    borderColor: colors.dark[950]
  }
});
