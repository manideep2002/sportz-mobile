import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useUiStore } from '@/store/uiStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const languages = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'];

export function LanguageScreen() {
  const navigation = useNavigation<Navigation>();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}><IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} /><AppText variant="h3">Language</AppText><View style={{ width: 40 }} /></View>
      {languages.map((item) => (
        <Pressable key={item} style={styles.row} onPress={() => setLanguage(item)}>
          <AppText style={styles.label}>{item}</AppText>
          {language === item ? <Check size={18} color={colors.orange[500]} /> : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderRadius: 14, backgroundColor: colors.dark[800] },
  label: { color: colors.text.primary, fontFamily: typography.bodyBold, fontSize: 14 }
});

