import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Chip, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useUiStore } from '@/store/uiStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const accentColors = ['orange', 'green', 'blue', 'pink'] as const;

export function AppearanceScreen() {
  const navigation = useNavigation<Navigation>();
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);
  const accentColor = useUiStore((state) => state.accentColor);
  const setAccentColor = useUiStore((state) => state.setAccentColor);
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}><IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} /><AppText variant="h3">Appearance</AppText><View style={{ width: 40 }} /></View>
      <View style={styles.row}>
        <AppText style={styles.label}>Theme</AppText>
        <View style={styles.chips}>
          {(['dark', 'light'] as const).map((mode) => <Chip key={mode} selected={themeMode === mode} onPress={() => setThemeMode(mode)}>{mode}</Chip>)}
        </View>
      </View>
      <View style={styles.row}>
        <AppText style={styles.label}>Accent color</AppText>
        <View style={styles.swatches}>
          {accentColors.map((item) => (
            <Pressable key={item} style={[styles.swatch, styles[item]]} onPress={() => setAccentColor(item)}>
              {accentColor === item ? <Check size={16} color={colors.light[0]} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: colors.dark[800] },
  label: { color: colors.text.primary, fontFamily: typography.bodyBold, fontSize: 14 },
  chips: { flexDirection: 'row', gap: spacing.xs },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  orange: { backgroundColor: colors.orange[500] },
  green: { backgroundColor: colors.semantic.success },
  blue: { backgroundColor: colors.semantic.info },
  pink: { backgroundColor: '#EC4899' }
});

