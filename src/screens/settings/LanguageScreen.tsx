import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing, typography } from '@/design/tokens';
import { supportedLanguages, useAppTranslation } from '@/i18n';
import type { AppStackParamList } from '@/navigation/routes';
import { useUiStore } from '@/store/uiStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function LanguageScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t('common.back')} icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">{t('language.title')}</AppText>
        <View style={{ width: 40 }} />
      </View>
      {supportedLanguages.map((item) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: language === item.locale }}
          key={item.locale}
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setLanguage(item.locale)}
        >
          <AppText style={[styles.label, { color: theme.text }]}>{t(item.translationKey)}</AppText>
          {language === item.locale ? <Check size={18} color={theme.accent} /> : null}
        </Pressable>
      ))}
      <AppText variant="small" style={styles.note}>{t('language.coverageNote')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  label: { fontFamily: typography.bodyBold, fontSize: 14 },
  note: { paddingHorizontal: spacing.xs }
});
