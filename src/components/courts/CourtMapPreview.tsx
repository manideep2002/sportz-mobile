import { MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { Court } from '@/types/domain';
import { openCourtInMaps } from '@/utils/maps';

export function CourtMapPreview({ court }: { court?: Court }) {
  const { colors: theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={court ? `Open ${court.name} in Maps` : 'Court location unavailable'}
      accessibilityState={{ disabled: !court }}
      disabled={!court}
      style={({ pressed }) => [
        styles.preview,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed ? styles.pressed : null,
        !court ? styles.disabled : null
      ]}
      onPress={() => void openCourtInMaps(court)}
    >
      <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
        <MapPin size={30} color={theme.accent} />
      </View>
      <View style={styles.content}>
        <AppText style={[styles.title, { color: theme.text }]}>{court?.name ?? 'Court location'}</AppText>
        <AppText variant="small">
          {court ? court.address || court.city : 'Select a court to view its location.'}
        </AppText>
        <AppText style={[styles.disclaimer, { color: theme.textSubtle }]}>Single-location preview</AppText>
      </View>
      <View style={[styles.button, { backgroundColor: theme.accent }]}>
        <AppText style={[styles.buttonText, { color: theme.onAccent }]}>Maps</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    padding: spacing.md
  },
  pressed: {
    opacity: 0.85
  },
  disabled: {
    opacity: 0.55
  },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft
  },
  content: {
    flex: 1,
    gap: 3
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold
  },
  disclaimer: {
    color: colors.text.tertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  button: {
    borderRadius: 10,
    backgroundColor: colors.orange[500],
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 12
  }
});
