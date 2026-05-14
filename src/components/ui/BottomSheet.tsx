import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { colors, radii, spacing } from '@/design/tokens';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

export function BottomSheet({ open, title, onClose, children }: PropsWithChildren<BottomSheetProps>) {
  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppText variant="h3">{title}</AppText>
            <IconButton icon={X} size={34} iconSize={16} onPress={onClose} />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlays.scrim,
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.dark[900],
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingBottom: 36,
    maxHeight: '86%'
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.dark[600],
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 18
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md
  }
});
