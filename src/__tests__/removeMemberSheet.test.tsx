import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { RemoveMemberSheet } from '@/components/community/RemoveMemberSheet';
import type { CommunityMember, UserProfile } from '@/types/domain';

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#22c55e',
      danger: '#ef4444',
      dangerSoft: '#ef444420',
      text: '#ffffff',
      textSubtle: '#9ca3af',
      surface: '#111827',
      surfaceElevated: '#1f2937',
      border: '#374151',
      scrim: 'rgba(0,0,0,0.7)',
      dark: { 700: '#374151', 800: '#1f2937' },
      overlays: { dangerSoft: '#ef444420' },
      semantic: { danger: '#ef4444' }
    }
  })
}));

const mockProfile: UserProfile = {
  id: 'user-42',
  displayName: 'Marcus Jordan',
  username: 'marcusj',
  avatarUrl: 'https://example.com/avatar.jpg',
  initials: 'MJ',
  bio: 'Hooper from Chicago',
  isVerified: true,
  sports: ['Basketball'],
  stats: { followers: 10, following: 5, posts: 2, winRate: 60, games: 8 }
};

const mockCommunityMember: CommunityMember = {
  userId: 'user-42',
  role: 'member',
  joinedAt: '2026-01-01T00:00:00Z',
  profile: mockProfile
};

describe('RemoveMemberSheet', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });
  it('renders member details and default warning message', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    await render(
      <RemoveMemberSheet
        open={true}
        member={mockProfile}
        contextName="Downtown Ballers"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Remove member')).toBeTruthy();
    expect(screen.getByText('Marcus Jordan')).toBeTruthy();
    expect(screen.getByText('@marcusj')).toBeTruthy();
    expect(
      screen.getByText(
        'Are you sure you want to remove Marcus Jordan from Downtown Ballers? They will lose access to member activity and content.'
      )
    ).toBeTruthy();

    const removeBtn = screen.getByRole('button', { name: 'Confirm remove Marcus Jordan' });
    fireEvent.press(removeBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.press(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles CommunityMember wrapper correctly', async () => {
    await render(
      <RemoveMemberSheet
        open={true}
        member={mockCommunityMember}
        contextName="Friday Pickup"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Marcus Jordan')).toBeTruthy();
    expect(screen.getByText('@marcusj')).toBeTruthy();
  });

  it('supports custom title and custom warningMessage', async () => {
    await render(
      <RemoveMemberSheet
        open={true}
        member={mockProfile}
        title="Remove attendee"
        warningMessage="Remove Marcus Jordan from this event?"
        confirmLabel="Remove Attendee"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Remove attendee')).toBeTruthy();
    expect(screen.getByText('Remove Marcus Jordan from this event?')).toBeTruthy();
    expect(screen.getByText('Remove Attendee')).toBeTruthy();
  });

  it('returns null when closed or without a member', async () => {
    const { toJSON } = await render(
      <RemoveMemberSheet
        open={false}
        member={mockProfile}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(toJSON()).toBeNull();
  });
});
