import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import {
  legalDocuments,
  type LegalDocumentKind
} from '@/constants/legalDocuments';
import { useAppTheme } from '@/design/ThemeProvider';
import { radii, spacing } from '@/design/tokens';

type Props = {
  kind: LegalDocumentKind;
  onBack: () => void;
};

export function LegalDocumentScreen({ kind, onBack }: Props) {
  const { colors } = useAppTheme();
  const document = legalDocuments[kind];

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={`Back from ${document.title}`}
          icon={ChevronLeft}
          onPress={onBack}
        />
        <AppText accessibilityRole="header" variant="h3">{document.title}</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View
        accessibilityLabel={`${document.title}, version ${document.version}, effective ${document.effectiveDate}`}
        style={[styles.versionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <AppText variant="caption">Current version</AppText>
        <AppText style={styles.versionText}>Version {document.version}</AppText>
        <AppText variant="small">Effective {document.effectiveDate}</AppText>
      </View>

      <AppText style={styles.intro}>{document.intro}</AppText>
      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText accessibilityRole="header" variant="h4">{section.heading}</AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph} variant="bodyMuted">{paragraph}</AppText>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  headerSpacer: {
    width: 44
  },
  versionCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.lg
  },
  versionText: {
    fontSize: 16
  },
  intro: {
    fontSize: 15,
    lineHeight: 23
  },
  section: {
    gap: spacing.sm
  }
});
