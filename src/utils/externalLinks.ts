import { Linking } from 'react-native';

export async function openExternalDestination(
  destination: string | undefined,
  browserFallback: string | undefined
): Promise<'opened' | 'fallback' | 'unavailable'> {
  if (destination) {
    try {
      if (await Linking.canOpenURL(destination)) {
        await Linking.openURL(destination);
        return 'opened';
      }
    } catch {
      // Try the browser fallback below. Some mail/store handlers reject after canOpenURL succeeds.
    }
  }
  if (browserFallback && browserFallback !== destination) {
    try {
      if (await Linking.canOpenURL(browserFallback)) {
        await Linking.openURL(browserFallback);
        return 'fallback';
      }
    } catch {
      // Report a visible failure to the caller.
    }
  }
  return 'unavailable';
}
