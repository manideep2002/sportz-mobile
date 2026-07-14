import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};
const mockRespondInvite = jest.fn();

const mockInviter = {
  id: 'player-2',
  username: 'maya',
  displayName: 'Maya Rao',
  initials: 'MR',
  avatarUrl: null
};
const mockInvite = {
  id: 'invite-7',
  status: 'pending',
  createdAt: '2026-07-14T10:00:00.000Z',
  inviter: mockInviter,
  community: {
    id: 'community-9',
    type: 'group',
    name: 'Bengaluru Ballers',
    slug: 'bengaluru-ballers',
    description: 'Pickup basketball',
    sport: 'Basketball',
    city: 'Bengaluru',
    memberCount: 12,
    isPrivate: true
  }
};

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation
}));
jest.mock('@/components/community/CommunityCard', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    CommunityCard: ({ community, onPress }: Record<string, any>) =>
      React.createElement(Pressable, { onPress }, React.createElement(Text, null, community.name))
  };
});
jest.mock('@/hooks/useCommunities', () => ({
  useCommunities: () => ({
    data: [],
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn()
  }),
  usePendingCommunityInvites: () => ({
    data: [mockInvite],
    isLoading: false,
    refetch: jest.fn()
  }),
  useRespondCommunityInvite: () => ({
    mutate: mockRespondInvite,
    isPending: false
  })
}));

// eslint-disable-next-line import/first
import { CommunityScreen } from '@/screens/community/CommunityScreen';

describe('CommunityScreen invites', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['Accept', true],
    ['Decline', false]
  ])('wires the %s action to the pending community invite', async (label, approve) => {
    await render(<CommunityScreen />);

    expect(screen.getByText('Bengaluru Ballers')).toBeTruthy();
    expect(screen.getByText('Maya Rao')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: label }));

    expect(mockRespondInvite).toHaveBeenCalledWith(
      {
        inviteId: 'invite-7',
        communityId: 'community-9',
        approve
      },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });
});








