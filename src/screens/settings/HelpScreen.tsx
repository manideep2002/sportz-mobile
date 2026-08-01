import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { AppText, Button, IconButton, Screen } from '@/components/ui';
import { appConfig } from '@/constants/app';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { openExternalDestination } from '@/utils/externalLinks';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const faqs = [
  ['How do I join an event?', 'Open an event and tap Join Event. Joined events unlock event chat.'],
  ['How do I message a player?', 'Open a player profile and tap Message to start a direct chat.'],
  ['How do I report content?', 'Use the more menu on a post or profile and choose Report.']
];

export function HelpScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const [open, setOpen] = useState<string | null>(faqs[0][0]);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [opening, setOpening] = useState<'support' | 'store' | null>(null);

  const openSupport = async () => {
    setOpening('support');
    setDestinationError(null);
    const result = await openExternalDestination(
      appConfig.supportEmail ? `mailto:${appConfig.supportEmail}` : undefined,
      appConfig.supportUrl
    );
    if (result === 'unavailable') setDestinationError('Support is not available on this device. Please try again later.');
    setOpening(null);
  };

  const openStore = async () => {
    setOpening('store');
    setDestinationError(null);
    const storeUrl = Platform.OS === 'ios' ? appConfig.appStoreUrl : appConfig.playStoreUrl;
    const result = await openExternalDestination(storeUrl, appConfig.installFallbackUrl);
    if (result === 'unavailable') setDestinationError('The install page could not be opened. Please try again later.');
    setOpening(null);
  };
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}><IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} /><AppText variant="h3">Help</AppText><View style={{ width: 40 }} /></View>
      {faqs.map(([question, answer]) => (
        <Pressable
          key={question}
          accessibilityRole="button"
          accessibilityLabel={question}
          accessibilityState={{ expanded: open === question }}
          style={[styles.faq, { backgroundColor: theme.surface }]}
          onPress={() => setOpen(open === question ? null : question)}
        >
          <AppText style={styles.question}>{question}</AppText>
          {open === question ? <AppText variant="bodyMuted">{answer}</AppText> : null}
        </Pressable>
      ))}
      {destinationError ? <AppText accessibilityRole="alert" style={{ color: theme.danger }}>{destinationError}</AppText> : null}
      <Button
        full
        disabled={opening !== null || (!appConfig.supportEmail && !appConfig.supportUrl)}
        loading={opening === 'support'}
        onPress={() => void openSupport()}
      >
        Contact Support
      </Button>
      <Button
        full
        variant="ghost"
        disabled={opening !== null || (!(Platform.OS === 'ios' ? appConfig.appStoreUrl : appConfig.playStoreUrl) && !appConfig.installFallbackUrl)}
        loading={opening === 'store'}
        onPress={() => void openStore()}
      >
        Rate the App
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faq: { gap: spacing.xs, padding: spacing.md, borderRadius: 14, backgroundColor: colors.dark[800] },
  question: { color: colors.text.primary, fontFamily: typography.bodyBold, fontSize: 14 }
});
