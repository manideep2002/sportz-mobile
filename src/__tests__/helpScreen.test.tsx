import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { appConfig } from '@/constants/app';
import { HelpScreen } from '@/screens/settings/HelpScreen';
import { openExternalDestination } from '@/utils/externalLinks';

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@/constants/app', () => ({
  appConfig: {
    name: 'SPORTZ',
    supportEmail: 'support@company.example',
    supportUrl: 'https://sportz.app/support',
    appStoreUrl: 'https://apps.apple.com/app/id123456789',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.company.sportz',
    installFallbackUrl: 'https://sportz.app/install'
  }
}));
jest.mock('@/utils/externalLinks', () => ({ openExternalDestination: jest.fn() }));

const mockAppConfig = appConfig as {
  supportEmail?: string;
  supportUrl?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  installFallbackUrl?: string;
};

describe('HelpScreen destinations', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = originalPlatform;
    Object.assign(mockAppConfig, {
      supportEmail: 'support@company.example',
      supportUrl: 'https://sportz.app/support',
      appStoreUrl: 'https://apps.apple.com/app/id123456789',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.company.sportz',
      installFallbackUrl: 'https://sportz.app/install'
    });
  });

  it('opens configured support mail with its browser fallback', async () => {
    (openExternalDestination as jest.Mock).mockResolvedValue('opened');
    const view = await render(<HelpScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Contact Support' }));

    await waitFor(() => {
      expect(openExternalDestination).toHaveBeenCalledWith(
        'mailto:support@company.example',
        'https://sportz.app/support'
      );
    });
  });

  it('uses the configured platform store and browser install fallback', async () => {
    (openExternalDestination as jest.Mock).mockResolvedValue('fallback');
    Platform.OS = 'android';
    const view = await render(<HelpScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Rate the App' }));

    await waitFor(() => {
      expect(openExternalDestination).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=com.company.sportz',
        'https://sportz.app/install'
      );
    });
  });

  it('shows a recoverable error when no configured destination can open', async () => {
    (openExternalDestination as jest.Mock).mockResolvedValue('unavailable');
    const view = await render(<HelpScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Contact Support' }));

    expect(await view.findByRole('alert')).toHaveTextContent('Support is not available on this device. Please try again later.');
    expect(view.getByRole('button', { name: 'Contact Support' })).toHaveProp(
      'accessibilityState',
      { disabled: false }
    );
  });

  it('does not render an actionable support control without a valid configured destination', async () => {
    mockAppConfig.supportEmail = undefined;
    mockAppConfig.supportUrl = undefined;
    const view = await render(<HelpScreen />);

    expect(view.getByRole('button', { name: 'Contact Support' })).toHaveProp(
      'accessibilityState',
      { disabled: true }
    );
  });
});
