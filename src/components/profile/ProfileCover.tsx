import { useEffect, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { colors } from '@/design/tokens';
import { mediaVariants } from '@/utils/mediaOptimization';

interface ProfileCoverProps {
  uri?: string | null;
  fallbackColors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ProfileCover({
  uri,
  fallbackColors = ['#0A0D1A', '#101629'],
  style,
  testID = 'profile-cover'
}: ProfileCoverProps) {
  const [loading, setLoading] = useState(Boolean(uri));
  const [imageError, setImageError] = useState(false);
  const [useOriginalUri, setUseOriginalUri] = useState(false);
  const optimizedUri = mediaVariants.profileCover(uri);
  const imageUri = useOriginalUri ? uri : optimizedUri;

  useEffect(() => {
    setLoading(Boolean(uri));
    setImageError(false);
    setUseOriginalUri(false);
  }, [uri]);

  const showImage = Boolean(imageUri && !imageError);

  return (
    <View style={[styles.root, style]} testID={testID}>
      <LinearGradient colors={[...fallbackColors]} style={StyleSheet.absoluteFill} />
      {showImage ? (
        <ExpoImage
          accessibilityLabel="Profile cover image"
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => {
            if (!useOriginalUri && uri && optimizedUri !== uri) {
              setUseOriginalUri(true);
              setLoading(true);
              return;
            }
            setImageError(true);
            setLoading(false);
          }}
          onLoad={() => setLoading(false)}
          source={{ uri: imageUri ?? undefined }}
          style={StyleSheet.absoluteFill}
          transition={180}
          testID={`${testID}-image`}
        />
      ) : null}
      {loading && showImage ? (
        <View pointerEvents="none" style={styles.loading} testID={`${testID}-loading`}>
          <ActivityIndicator color={colors.light[0]} />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.border} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden'
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 8, 18, 0.3)',
    justifyContent: 'center'
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,90,31,0.25)',
    borderWidth: StyleSheet.hairlineWidth
  }
});
