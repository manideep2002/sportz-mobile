import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors } from '@/design/tokens';

interface SectionHeaderProps {
  title: string;
  action?: string;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="h4">{title}</AppText>
      {action ? <AppText style={styles.action}>{action}</AppText> : null}
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
