import { useEffect, useRef, type PropsWithChildren } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { colors, radii, spacing } from '@/design/tokens';
import { useAppTheme } from '@/design/ThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onDismiss?: () => void;
}

export function BottomSheet({ open, title, onClose, onDismiss, children }: PropsWithChildren<BottomSheetProps>) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const titleRef = useRef<View>(null);

  useEffect(() => {
    if (!open) return;
    AccessibilityInfo.announceForAccessibility(title);
    const focusFrame = requestAnimationFrame(() => {
      const target = findNodeHandle(titleRef.current);
      if (target) AccessibilityInfo.setAccessibilityFocus(target);
    });
    return () => cancelAnimationFrame(focusFrame);
  }, [open, title]);

  return (
    <Modal transparent visible={open} animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} onDismiss={onDismiss} statusBarTranslucent>
      <Pressable accessible={false} style={[styles.scrim, { backgroundColor: theme.colors.scrim }]} onPress={onClose}>
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.colors.surfaceElevated }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <View style={styles.header}>
            <View ref={titleRef} accessible accessibilityRole="header">
              <AppText variant="h3">{title}</AppText>
            </View>
            <IconButton icon={X} size={34} iconSize={16} accessibilityLabel={`Close ${title}`} onPress={onClose} />
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
