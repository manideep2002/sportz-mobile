import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/design/tokens';
import { useResponsiveLayout } from '@/layout/responsive';

interface AdaptiveSplitViewProps {
  primary: ReactNode;
  secondary: ReactNode;
  style?: StyleProp<ViewStyle>;
  primaryStyle?: StyleProp<ViewStyle>;
  secondaryStyle?: StyleProp<ViewStyle>;
}

export function AdaptiveSplitView({
  primary,
  secondary,
  style,
  primaryStyle,
  secondaryStyle
}: PropsWithChildren<AdaptiveSplitViewProps>) {
  const responsive = useResponsiveLayout();
  return (
    <View
      testID="adaptive-split-view"
      accessibilityLabel={responsive.supportsSplitPane ? 'Split view' : 'Stacked view'}
      style={[styles.root, responsive.supportsSplitPane ? styles.split : styles.stacked, style]}
    >
      <View style={[styles.primary, responsive.supportsSplitPane ? styles.primarySplit : null, primaryStyle]}>
        {primary}
      </View>
      <View style={[styles.secondary, secondaryStyle]}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: spacing.md
  },
  split: {
    flexDirection: 'row'
  },
  stacked: {
    flexDirection: 'column'
  },
  primary: {
    minWidth: 0
  },
  primarySplit: {
    flexBasis: 360,
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 420
  },
  secondary: {
    flex: 1,
    minWidth: 0,
    minHeight: 0
  }
});
