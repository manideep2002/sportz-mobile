import { Alert, Linking, Platform } from 'react-native';

import type { Court } from '@/types/domain';

export async function openCourtInMaps(court?: Court | null) {
  if (!court) {
    Alert.alert('Location unavailable', 'Court location details are not available.');
    return;
  }

  const { latitude, longitude, name, city } = court;
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number' && (latitude !== 0 || longitude !== 0);
  const locationLabel = [name, city].filter(Boolean).join(', ');

  if (!hasCoords && !locationLabel) {
    Alert.alert('Location unavailable', 'No location or coordinates available for this court.');
    return;
  }

  const query = encodeURIComponent(
    hasCoords && locationLabel ? `${locationLabel} (${latitude},${longitude})` : hasCoords ? `${latitude},${longitude}` : locationLabel
  );

  let primaryUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  if (Platform.OS === 'ios') {
    primaryUrl = hasCoords
      ? `https://maps.apple.com/?q=${encodeURIComponent(locationLabel || 'Court')}&ll=${latitude},${longitude}`
      : `https://maps.apple.com/?q=${encodeURIComponent(locationLabel)}`;
  } else if (Platform.OS === 'android') {
    primaryUrl = hasCoords
      ? `geo:${latitude},${longitude}?q=${encodeURIComponent(locationLabel || `${latitude},${longitude}`)}`
      : `geo:0,0?q=${encodeURIComponent(locationLabel)}`;
  }

  const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    hasCoords ? `${latitude},${longitude}` : locationLabel
  )}`;

  try {
    const canOpen = await Linking.canOpenURL(primaryUrl);
    if (canOpen) {
      await Linking.openURL(primaryUrl);
    } else {
      await Linking.openURL(fallbackUrl);
    }
  } catch {
    try {
      await Linking.openURL(fallbackUrl);
    } catch {
      Alert.alert('Could not open maps', 'Unable to open maps application or web browser.');
    }
  }
}
