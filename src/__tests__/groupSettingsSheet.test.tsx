import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { GroupSettingsSheet } from '@/components/community/GroupSettingsSheet';
import type { Community } from '@/types/domain';

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#22c55e',
      accentSoft: '#22c55e20',
      danger: '#ef4444',
      dangerSoft: '#ef444420',
      text: '#ffffff',
      surface: '#111827',
      border: '#374151',
      dark: { 700: '#374151', 800: '#1f2937' },
      overlays: { orangeSoft: '#f9731620', dangerSoft: '#ef444420' },
      semantic: { danger: '#ef4444' }
    }
  })
}));

const mockGroup: Community = {
  id: 'group-1',
  name: 'Downtown Basketball Club',
  type: 'group',
  sport: 'Basketball',
  city: 'New York',
  description: 'A community for basketball enthusiasts in downtown NYC.',
  avatarUrl: 'https://example.com/avatar.jpg',
  coverUrl: 'https://example.com/cover.jpg',
  memberCount: 15,
  isPrivate: true,
  isAdmin: true,
  isOwner: false,
  isMember: true,
  canPost: true,
  canViewContent: true,
  canManageMembers: true,
  membershipStatus: 'admin',
  isArchived: false
};

const mockPage: Community = {
  id: 'page-1',
  name: 'Official Tennis Academy',
  type: 'page',
  sport: 'Tennis',
  city: 'London',
  description: 'Official tennis coaching and news.',
  avatarUrl: null,
  coverUrl: null,
  memberCount: 0,
  followerCount: 240,
  isPrivate: false,
  isAdmin: false,
  isOwner: false,
  isMember: true,
  canPost: false,
  canViewContent: true,
  canManageMembers: false,
  membershipStatus: 'follower',
  isArchived: false
};

describe('GroupSettingsSheet', () => {
  it('renders group summary and actions correctly for group admin', async () => {
    const onShare = jest.fn();
    const onInvite = jest.fn();
    const onScheduleEvent = jest.fn();
    const onCreatePost = jest.fn();
    const onManage = jest.fn();
    const onReport = jest.fn();
    const onLeave = jest.fn();
    const onClose = jest.fn();

    await render(
      <GroupSettingsSheet
        open={true}
        community={mockGroup}
        onClose={onClose}
        onShare={onShare}
        onInvite={onInvite}
        onScheduleEvent={onScheduleEvent}
        onCreatePost={onCreatePost}
        onManage={onManage}
        onReport={onReport}
        onLeave={onLeave}
      />
    );

    expect(screen.getByText('Group settings')).toBeTruthy();
    expect(screen.getByText('Downtown Basketball Club')).toBeTruthy();
    expect(screen.getByText('Basketball • Private group • 15 members')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Share group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite players' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schedule event' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create post' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave group' })).toBeTruthy();

    // Trigger share
    fireEvent.press(screen.getByRole('button', { name: 'Share group' }));
    expect(onClose).toHaveBeenCalled();
    expect(onShare).toHaveBeenCalled();
  });

  it('hides owner-restricted actions when user is the owner', async () => {
    const ownerGroup: Community = {
      ...mockGroup,
      isOwner: true,
      membershipStatus: 'owner'
    };

    await render(
      <GroupSettingsSheet
        open={true}
        community={ownerGroup}
        onClose={jest.fn()}
        onShare={jest.fn()}
      />
    );

    // Owner should not see "Report group" or "Leave group"
    expect(screen.queryByRole('button', { name: 'Report group' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leave group' })).toBeNull();
  });

  it('renders page summary and actions for pages', async () => {
    await render(
      <GroupSettingsSheet
        open={true}
        community={mockPage}
        onClose={jest.fn()}
        onShare={jest.fn()}
      />
    );

    expect(screen.getByText('Page settings')).toBeTruthy();
    expect(screen.getByText('Official Tennis Academy')).toBeTruthy();
    expect(screen.getByText('Tennis • Page • 240 followers')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Share page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unfollow page' })).toBeTruthy();
    // Non-admin page member cannot manage page or create post if canPost is false
    expect(screen.queryByRole('button', { name: 'Manage page' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create post' })).toBeNull();
  });

  it('returns null when community is not provided or closed', async () => {
    await render(
      <GroupSettingsSheet
        open={false}
        community={mockGroup}
        onClose={jest.fn()}
        onShare={jest.fn()}
      />
    );

    expect(screen.toJSON()).toBeNull();
  });
});
