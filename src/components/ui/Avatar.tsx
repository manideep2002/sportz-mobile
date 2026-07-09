import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, typography } from '@/design/tokens';
import { mediaVariants } from '@/utils/mediaOptimization';

type AvatarTone = 'orange' | 'green' | 'blue' | 'pink' | 'yellow' | 'dark';

interface AvatarProps {
  initials: string;
  size?: number;
  tone?: AvatarTone;
  online?: boolean;
  uri?: string | null;
}

const gradients: Record<AvatarTone, [string, string]> = {
  orange: [colors.orange[500], colors.orange[600]],
  green: [colors.semantic.success, colors.semantic.successDark],
  blue: [colors.semantic.info, '#1D4ED8'],
  pink: ['#EC4899', '#9333EA'],
  yellow: [colors.semantic.warning, '#D97706'],
  dark: [colors.dark[700], colors.dark[600]]
};

export function Avatar({ initials, size = 42, tone = 'orange', online = false, uri }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [useOriginalUri, setUseOriginalUri] = useState(false);
  const optimizedUri = mediaVariants.avatar(uri, size);
  const imageUri = useOriginalUri ? uri : optimizedUri;

  useEffect(() => {
    setImageError(false);
    setUseOriginalUri(false);
  }, [uri]);

  const showFallback = !imageUri || imageError;

  return (
    <View style={{ width: size, height: size }}>
      {showFallback ? (
        <LinearGradient colors={gradients[tone]} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
          <AppText style={[styles.initials, { fontSize: Math.max(10, size * 0.34) }]}>{initials}</AppText>
        </LinearGradient>
      ) : (
        <Image
          source={{ uri: imageUri }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => {
            if (!useOriginalUri && uri && optimizedUri !== uri) {
              setUseOriginalUri(true);
              return;
            }
            setImageError(true);
          }}
        />
      )}
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
