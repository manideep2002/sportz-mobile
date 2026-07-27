import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemeProvider } from '@/design/ThemeProvider';
import { HelpScreen } from '@/screens/settings/HelpScreen';
import { NotificationSettingsScreen } from '@/screens/settings/NotificationSettingsScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() })
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ addListener: jest.fn(), play: jest.fn(), pause: jest.fn(), release: jest.fn() }),
  VideoView: 'VideoView'
}));

jest.mock('@/lib/notifications', () => ({
  defaultNotificationPreferences: {
    likes: true,
    comments: true,
    mentions: true,
    follows: true,
    messages: true,
    events: true,
    invites: true
  },
  saveNotificationPreferences: jest.fn(),
  notificationPreferencesKey: 'notification-preferences',
  pushNotificationsEnabledKey: 'push-notifications-enabled'
}));

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

describe('shared accessibility semantics', () => {
  it('derives the accessible name of an input from its visual label', async () => {
    await renderWithTheme(<Input label="Email address" value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('Email address')).toBeTruthy();
  });

  it('announces chips as selected buttons and preserves a 44 point target', async () => {
    await renderWithTheme(<Chip selected>Basketball</Chip>);
    const chip = screen.getByRole('button', { name: 'Basketball' });
    expect(chip).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(chip).toHaveStyle({ minHeight: 44 });
  });

  it('uses a meaningful fallback label for common icon-only controls', async () => {
    await renderWithTheme(<IconButton icon={ChevronLeft} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveStyle({ width: 44, height: 44 });
  });

  it('exposes segmented options as a checked radio group', async () => {
    await renderWithTheme(
      <SegmentedControl value="Upcoming" options={['Upcoming', 'Past']} onChange={jest.fn()} accessibilityLabel="Event status" />
    );
    expect(screen.getByLabelText('Event status')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByRole('radio', { name: 'Upcoming' })).toHaveProp('accessibilityState', { checked: true });
    expect(screen.getByRole('radio', { name: 'Past' })).toHaveProp('accessibilityState', { checked: false });
  });

  it('gives a bottom sheet a discoverable title and close control', async () => {
    await renderWithTheme(
      <BottomSheet open title="Filter events" onClose={jest.fn()}>
        <Button>Apply filters</Button>
      </BottomSheet>
    );
    expect(screen.getByRole('header', { name: 'Filter events' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close Filter events' })).toBeTruthy();
  });
});

describe('core-screen accessibility order and state', () => {
  it('keeps FAQ controls reachable in visual order and announces expansion', async () => {
    await renderWithTheme(<HelpScreen />);
    const focusOrder = screen.getAllByRole('button').slice(0, 3).map((node) => node.props.accessibilityLabel);
    expect(focusOrder).toEqual(['Back', 'How do I join an event?', 'How do I message a player?']);
    const faq = screen.getByRole('button', { name: 'How do I message a player?' });
    expect(faq).toHaveProp('accessibilityState', { expanded: false });
    fireEvent.press(faq);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'How do I message a player?' })).toHaveProp('accessibilityState', { expanded: true });
    });
  });

  it('keeps long primary actions in a scalable minimum-height button', async () => {
    await renderWithTheme(<Button full size="lg">Continue with an accessible, long action label</Button>);
    const button = screen.getByRole('button', { name: 'Continue with an accessible, long action label' });
    expect(button).toHaveStyle({ minHeight: 44 });
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ disabled: false }));
  });

  it('announces settings toggles as checked switches', async () => {
    await renderWithTheme(<NotificationSettingsScreen />);
    expect(
      screen.getByText('Activity notifications remain available in the in-app Notifications screen. These controls only change push alerts.')
    ).toBeTruthy();
    expect(screen.queryByText(/email alerts/i)).toBeNull();
    expect(screen.getByRole('switch', { name: 'Push notifications' })).toHaveProp(
      'accessibilityState',
      { checked: true }
    );
  });
});
