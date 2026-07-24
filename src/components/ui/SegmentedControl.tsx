import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, typography } from '@/design/tokens';

interface SegmentedControlProps<T extends string> {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}

export function SegmentedControl<T extends string>({ value, options, onChange, getLabel }: SegmentedControlProps<T>) {
  const { colors: theme } = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.item, selected ? styles.selected : null, selected ? { backgroundColor: theme.accent } : null]}
          >
            <AppText style={[styles.label, { color: selected ? theme.onAccent : theme.textMuted }]}>{getLabel?.(option) ?? option}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: colors.dark[800],
    borderRadius: radii.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  item: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.sm,
    paddingVertical: 9
  },
  selected: {
    backgroundColor: colors.orange[500]
  },
  label: {
    color: colors.text.tertiary,
    fontFamily: typography.headingBold,
    fontSize: 13
  },
  selectedLabel: {
    color: colors.light[0]
  }
});
