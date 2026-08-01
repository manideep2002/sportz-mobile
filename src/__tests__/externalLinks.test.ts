import { Linking } from 'react-native';

import { openExternalDestination } from '@/utils/externalLinks';

jest.mock('react-native', () => {
  const ReactNative = jest.requireActual('react-native');
  ReactNative.Linking.canOpenURL = jest.fn();
  ReactNative.Linking.openURL = jest.fn();
  return ReactNative;
});

describe('openExternalDestination', () => {
  const primary = 'mailto:support@sportz.app';
  const fallback = 'https://sportz.app/support';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens a supported primary destination', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(true);

    await expect(openExternalDestination(primary, fallback)).resolves.toBe('opened');
    expect(Linking.openURL).toHaveBeenCalledWith(primary);
  });

  it('uses the browser fallback when the primary target is unavailable', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(true);

    await expect(openExternalDestination(primary, fallback)).resolves.toBe('fallback');
    expect(Linking.openURL).toHaveBeenCalledWith(fallback);
  });

  it('uses the browser fallback when opening the primary target fails', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('mail client failed')).mockResolvedValueOnce(true);

    await expect(openExternalDestination(primary, fallback)).resolves.toBe('fallback');
    expect(Linking.openURL).toHaveBeenNthCalledWith(1, primary);
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, fallback);
  });

  it('reports unavailable when neither destination can be opened', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    await expect(openExternalDestination(primary, fallback)).resolves.toBe('unavailable');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
