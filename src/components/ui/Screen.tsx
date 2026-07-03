import type { PropsWithChildren, ReactElement } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/design/tokens';

interface ScreenProps {
  scroll?: boolean;
  withTabPadding?: boolean;
  keyboard?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function Screen({
  children,
  scroll = true,
  withTabPadding = false,
  keyboard = false,
  style,
  contentContainerStyle,
  refreshControl
}: PropsWithChildren<ScreenProps>) {
  const insets = useSafeAreaInsets();
  const bottomPadding = withTabPadding ? layout.tabBarHeight + spacing.md : Math.max(insets.bottom, spacing.lg);
  const contentStyle = [
    styles.content,
    { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: bottomPadding },
    contentContainerStyle
  ];

  const body = scroll ? (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={contentStyle}
      refreshControl={refreshControl}
      alwaysBounceVertical
      bounces
      overScrollMode="always"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.root, contentStyle, style]}>{children}</View>
  );

  if (!keyboard) return body;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen
  }
});
