import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, shadows, spacing } from '@/design/tokens';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ children, padded = true, style, ...props }: PropsWithChildren<CardProps>) {
  return (
    <View style={[styles.card, padded ? styles.padded : null, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark[800],
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    overflow: 'hidden',
    ...shadows.card
  },
  padded: {
    padding: spacing.md
  }
});
