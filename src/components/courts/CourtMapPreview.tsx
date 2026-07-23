import { MapPin } from 'lucide-react-native';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { Court } from '@/types/domain';

export function CourtMapPreview({ court }: { court?: Court }) {
  const openMaps = async () => {
    if (!court) return;
    const query = encodeURIComponent(`${court.latitude},${court.longitude}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      if (!(await Linking.canOpenURL(url))) {
        throw new Error('No compatible maps application is available.');
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Could not open maps',
        error instanceof Error ? error.message : 'Copy the court address and try another maps application.'
      );
    }
  };

  return (
    <View style={styles.preview}>
      <View style={styles.icon}>
        <MapPin size={30} color={colors.orange[500]} />
      </View>
      <View style={styles.content}>
        <AppText style={styles.title}>{court?.name ?? 'Court location'}</AppText>
        <AppText variant="small">
          {court ? court.address || court.city : 'Select a court to view its location.'}
        </AppText>
        <AppText style={styles.disclaimer}>Single-location preview</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={court ? `Open ${court.name} in Maps` : 'Open court in Maps'}
        style={[styles.button, !court ? styles.disabled : null]}
        onPress={() => void openMaps()}
        disabled={!court}
      >
        <AppText style={styles.buttonText}>Maps</AppText>
      </Pressable>
    </View>
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
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  disabled: {
    opacity: 0.45
  },
  buttonText: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 12
  }
});
