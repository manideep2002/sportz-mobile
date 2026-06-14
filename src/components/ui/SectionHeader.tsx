import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors } from '@/design/tokens';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="h4">{title}</AppText>
      {action ? (
        <Pressable accessibilityRole={onAction ? 'button' : undefined} disabled={!onAction} onPress={onAction}>
          <AppText style={styles.action}>{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  action: {
    color: colors.orange[400],
    fontSize: 12,
    fontWeight: '600'
  }
});
