import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';
import { mediaVariants } from '@/utils/mediaOptimization';
import { IconButton } from './IconButton';

interface MediaViewerModalProps {
  visible: boolean;
  uri?: string | null;
  onClose: () => void;
}

export function MediaViewerModal({ visible, uri, onClose }: MediaViewerModalProps) {
  const [useRawUri, setUseRawUri] = useState(false);
  const optimizedUri = mediaVariants.fullImage(uri);
  const imageUri = useRawUri ? uri : optimizedUri;

  useEffect(() => {
    setUseRawUri(false);
  }, [uri, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" style={styles.scrim} onPress={onClose}>
        <View style={styles.header}>
          <IconButton icon={X} accessibilityLabel="Close image viewer" onPress={onClose} />
        </View>
        {imageUri ? (
          <Pressable style={styles.imageFrame} onPress={(event) => event.stopPropagation()}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onError={() => {
                if (!useRawUri && uri && optimizedUri !== uri) {
                  setUseRawUri(true);
                }
              }}
            />
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center'
  },
  header: {
    position: 'absolute',
    top: 48,
    right: spacing.screen,
    zIndex: 2
  },
  imageFrame: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 88
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.dark[950]
  }
});
