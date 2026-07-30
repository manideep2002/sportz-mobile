import { act, render, screen } from '@testing-library/react-native';

import { ConversationRow } from '@/components/messages/ConversationRow';
import { useUiStore } from '@/store/uiStore';
import type { Conversation, UserProfile } from '@/types/domain';

jest.mock('@/components/ui', () => ({
  ...jest.requireActual('@/test/mockUi'),
  Avatar: ({ online }: { online?: boolean }) => {
    const { View } = jest.requireActual('react-native');
    return <View testID="conversation-avatar" accessibilityState={{ selected: Boolean(online) }} />;
  }
}));
jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#f60',
      border: '#222',
      text: '#fff',
      textMuted: '#888',
      textSubtle: '#777',
      onAccent: '#000'
    }
  })
}));

const profile = (id: string, isOnline: boolean): UserProfile => ({
  id,
  username: id,
  displayName: id,
  initials: id.slice(0, 2),
  bio: '',
  city: '',
  country: '',
  primarySport: 'Football',
  sports: ['Football'],
  skillLevel: 'Beginner',
  isOnline,
  badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
});

const conversation: Conversation = {
  id: 'room-1',
  title: 'Peer',
  participants: [profile('me', true), profile('peer', true)],
  isGroup: false,
  lastMessage: 'Hello',
  lastMessageAt: '2026-07-30T12:00:00.000Z',
  unreadCount: 0
};

describe('conversation presence indicator', () => {
  beforeEach(() => {
    useUiStore.getState().setOnlineUserIds([]);
  });

  it('ignores a stale database is_online flag and follows verified live presence', async () => {
    await render(
      <ConversationRow
        conversation={conversation}
        currentUserId="me"
        onPress={jest.fn()}
      />
    );

    expect(screen.getByTestId('conversation-avatar').props.accessibilityState.selected).toBe(false);

    await act(async () => {
      useUiStore.getState().setOnlineUserIds(['peer']);
    });
    expect(await screen.findByTestId('conversation-avatar')).toHaveProp(
      'accessibilityState',
      { selected: true }
    );

    await act(async () => {
      useUiStore.getState().setOnlineUserIds([]);
    });
    expect(screen.getByTestId('conversation-avatar').props.accessibilityState.selected).toBe(false);
  });
});
