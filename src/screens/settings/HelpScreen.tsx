import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { AppText, Button, IconButton, Screen } from '@/components/ui';
import { appConfig } from '@/constants/app';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const faqs = [
  ['How do I join an event?', 'Open an event and tap Join Event. Joined events unlock event chat.'],
  ['How do I message a player?', 'Open a player profile and tap Message to start a direct chat.'],
  ['How do I report content?', 'Use the more menu on a post or profile and choose Report.']
];

export function HelpScreen() {
  const navigation = useNavigation<Navigation>();
  const [open, setOpen] = useState<string | null>(faqs[0][0]);
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}><IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} /><AppText variant="h3">Help</AppText><View style={{ width: 40 }} /></View>
      {faqs.map(([question, answer]) => (
        <Pressable key={question} style={styles.faq} onPress={() => setOpen(open === question ? null : question)}>
          <AppText style={styles.question}>{question}</AppText>
          {open === question ? <AppText variant="bodyMuted">{answer}</AppText> : null}
        </Pressable>
      ))}
      <Button full onPress={() => void Linking.openURL(`mailto:${appConfig.supportEmail}`)}>Contact Support</Button>
      <Button full variant="ghost" onPress={() => void Linking.openURL(Platform.OS === 'ios' ? appConfig.appStoreUrl : appConfig.playStoreUrl)}>Rate the App</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faq: { gap: spacing.xs, padding: spacing.md, borderRadius: 14, backgroundColor: colors.dark[800] },
  question: { color: colors.text.primary, fontFamily: typography.bodyBold, fontSize: 14 }
});

