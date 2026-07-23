import { fireEvent, render, screen } from '@testing-library/react-native';

import { env } from '@/lib/env';
import { ProfileCover } from '@/components/profile/ProfileCover';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));

describe('ProfileCover', () => {
  const coverUrl = `${env.supabaseUrl}/storage/v1/object/sign/profile-covers/user-1/cover.jpg?token=test`;

  it('renders an optimized cover with a loading state and clears it after load', async () => {
    await render(<ProfileCover uri={coverUrl} />);

    expect(screen.getByTestId('profile-cover-loading')).toBeTruthy();
    expect(screen.getByTestId('profile-cover-image').props.source.uri).toContain(
      '/storage/v1/render/image/sign/profile-covers/'
    );

    await fireEvent(screen.getByTestId('profile-cover-image'), 'load');
    expect(screen.queryByTestId('profile-cover-loading')).toBeNull();
  });

  it('retries the original signed image and then falls back safely on failure', async () => {
    await render(<ProfileCover uri={coverUrl} />);

    await fireEvent(screen.getByTestId('profile-cover-image'), 'error');
    expect(screen.getByTestId('profile-cover-image').props.source.uri).toBe(coverUrl);

    await fireEvent(screen.getByTestId('profile-cover-image'), 'error');
    expect(screen.queryByTestId('profile-cover-image')).toBeNull();
    expect(screen.getByTestId('profile-cover')).toBeTruthy();
  });

  it('shows only the gradient fallback after cover removal', async () => {
    const view = await render(<ProfileCover uri={coverUrl} />);
    await view.rerender(<ProfileCover uri={null} />);

    expect(screen.queryByTestId('profile-cover-image')).toBeNull();
    expect(screen.queryByTestId('profile-cover-loading')).toBeNull();
  });
});
