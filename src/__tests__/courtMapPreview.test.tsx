import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import { CourtMapPreview } from '@/components/courts/CourtMapPreview';
import type { Court } from '@/types/domain';

jest.mock('@/components/ui', () => require('@/test/mockUi'));

const court = {
  id: 'court-1',
  name: 'Indiranagar Arena',
  sport: 'Basketball',
  city: 'Bengaluru',
  address: '100 Feet Road',
  latitude: 12.9,
  longitude: 77.6
} as Court;

describe('CourtMapPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the selected court in the platform Maps application', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<CourtMapPreview court={court} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open Indiranagar Arena in Maps' }));

    await waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));
    expect(openUrl.mock.calls[0][0]).toBe(
      Platform.OS === 'ios'
        ? 'https://maps.apple.com/?q=Indiranagar%20Arena%2C%20Bengaluru&ll=12.9,77.6'
        : Platform.OS === 'android'
          ? 'geo:12.9,77.6?q=Indiranagar%20Arena%2C%20Bengaluru'
          : 'https://www.google.com/maps/search/?api=1&query=Indiranagar%20Arena%2C%20Bengaluru%20(12.9%2C77.6)'
    );
  });

  it('falls back to Google Maps when the native URL cannot be opened', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('Native maps unavailable'))
      .mockResolvedValueOnce(true);
    await render(<CourtMapPreview court={court} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open Indiranagar Arena in Maps' }));

    await waitFor(() => expect(openUrl).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=12.9%2C77.6'
    ));
  });

  it('announces an unavailable location when discovery has no selected court', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<CourtMapPreview />);

    const mapsButton = screen.getByRole('button', { name: 'Court location unavailable' });
    expect(mapsButton.props.accessibilityState.disabled).toBe(true);
    expect(openUrl).not.toHaveBeenCalled();
  });
});
