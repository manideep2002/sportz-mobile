import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTranslation } from '@/i18n';

import { AppText, Chip, IconButton, Screen } from '@/components/ui';
import { createAppTheme, useAppTheme } from '@/design/ThemeProvider';
import { spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useUiStore, type AccentColor } from '@/store/uiStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const accentColors = ['orange', 'green', 'blue', 'pink'] as const;

export function AppearanceScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);
  const accentColor = useUiStore((state) => state.accentColor);
  const setAccentColor = useUiStore((state) => state.setAccentColor);
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t('common.back')} icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">{t('appearance.title')}</AppText>
        <View style={{ width: 40 }} />
      </View>
      <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText style={[styles.label, { color: theme.text }]}>{t('appearance.theme')}</AppText>
        <View style={styles.chips}>
          {(['dark', 'light'] as const).map((mode) => (
            <Chip key={mode} selected={themeMode === mode} onPress={() => setThemeMode(mode)}>
              {t(`appearance.${mode}`)}
            </Chip>
          ))}
        </View>
      </View>
      <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText style={[styles.label, { color: theme.text }]}>{t('appearance.accent')}</AppText>
        <View style={styles.swatches}>
          {accentColors.map((item) => (
            <Pressable
              accessibilityLabel={t(`appearance.${item}`)}
              accessibilityRole="radio"
              accessibilityState={{ checked: accentColor === item }}
              key={item}
              style={[
                styles.swatch,
                { backgroundColor: createAppTheme(themeMode, item as AccentColor).colors.accent },
                accentColor === item ? { borderColor: theme.text } : null
              ]}
              onPress={() => setAccentColor(item)}
            >
              {accentColor === item ? <Check size={16} color={theme.onAccent} /> : null}
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
  row: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  label: { fontFamily: typography.bodyBold, fontSize: 14 },
  chips: { flexDirection: 'row', gap: spacing.xs },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }
});
