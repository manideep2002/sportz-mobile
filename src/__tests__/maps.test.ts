import { Alert, Linking, Platform } from 'react-native';

import type { Court } from '@/types/domain';
import { openCourtInMaps } from '@/utils/maps';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Linking.openURL = jest.fn().mockResolvedValue(true);
  RN.Linking.canOpenURL = jest.fn().mockResolvedValue(true);
  RN.Alert.alert = jest.fn();
  return RN;
});

const sampleCourt: Court = {
  id: 'court-1',
  name: 'Koramangala Indoor',
  sport: 'Basketball',
  city: 'Bengaluru',
  latitude: 12.9352,
  longitude: 77.6245,
  distanceKm: 2.5,
  surface: 'Synthetic',
  rating: 4.8,
  hourlyPrice: 400,
  currency: 'INR',
  availableNow: true,
  availabilityLabel: 'Available'
};

describe('openCourtInMaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows alert when court is null or undefined', async () => {
    await openCourtInMaps(null);
    expect(Alert.alert).toHaveBeenCalledWith('Location unavailable', expect.any(String));

    await openCourtInMaps(undefined);
    expect(Alert.alert).toHaveBeenLastCalledWith('Location unavailable', expect.any(String));
  });

  it('calls Linking.openURL with proper params when court is provided on iOS', async () => {
    Platform.OS = 'ios';
    await openCourtInMaps(sampleCourt);
    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('maps.apple.com')
    );
  });

  it('calls Linking.openURL with geo link on Android', async () => {
    Platform.OS = 'android';
    await openCourtInMaps(sampleCourt);
    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('geo:12.9352,77.6245')
    );
  });

  it('falls back to google web maps link if primary link cannot be opened', async () => {
    Platform.OS = 'android';
    (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);
    await openCourtInMaps(sampleCourt);
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('google.com/maps/search')
    );
  });
});
