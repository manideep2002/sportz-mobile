import { useState } from 'react';
import { MapPin } from 'lucide-react-native';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { Court } from '@/types/domain';

export function CourtMapPreview({ court }: { court?: Court }) {
  const { colors: theme } = useAppTheme();
  const [opening, setOpening] = useState(false);

  const openMaps = async () => {
    if (opening) return;
    const coordinates = court ? `${court.latitude},${court.longitude}` : null;
    const query = court ? coordinates : 'sports courts near me';
    const label = encodeURIComponent(court?.name ?? 'Sports courts near me');
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query ?? '')}`;
    const nativeUrl = Platform.select({
      ios: court ? `maps://?q=${label}&ll=${coordinates}` : `maps://?q=${label}`,
      android: court ? `geo:${coordinates}?q=${coordinates}(${label})` : `geo:0,0?q=${label}`,
      default: webUrl
    }) ?? webUrl;

    setOpening(true);
    try {
      await Linking.openURL(nativeUrl);
    } catch {
      try {
        if (nativeUrl === webUrl) throw new Error('No compatible maps application is available.');
        await Linking.openURL(webUrl);
      } catch (error) {
        Alert.alert(
          'Could not open maps',
          error instanceof Error ? error.message : 'Copy the court address and try another maps application.'
        );
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={court ? `Open ${court.name} in Maps` : 'Find sports courts in Maps'}
        accessibilityState={{ busy: opening, disabled: opening }}
        hitSlop={10}
        style={[styles.button, { backgroundColor: theme.accent }, opening ? styles.disabled : null]}
        onPress={() => void openMaps()}
        disabled={opening}
      >
        <AppText style={[styles.buttonText, { color: theme.onAccent }]}>{opening ? 'Opening…' : 'Maps'}</AppText>
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
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
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
