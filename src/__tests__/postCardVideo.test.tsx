import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import type { Post } from '@/types/domain';

jest.mock('@/components/ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ui = require('@/test/mockUi');
  return {
    ...ui,
    MediaViewerModal: () => null,
    VideoPlayer: (props: Record<string, unknown>) =>
      React.createElement(View, {
        testID: props.testID,
        accessibilityLabel: `player-${String(props.paused)}-${String(props.muted)}`
      })
  };
});

jest.mock('@/components/social/LikeButton', () => ({
  LikeButton: () => null
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => React.createElement(View, props)
  };
});

jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#ff6600',
      accentBorder: '#ff9966',
      accentSoft: '#331100',
      border: '#333333',
      onAccent: '#ffffff',
      surfaceMuted: '#222222',
      textSubtle: '#aaaaaa'
    }
  })
}));

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'post-1',
  author: {
    id: 'author-1',
    username: 'athlete',
    displayName: 'Test Athlete',
    initials: 'TA',
    bio: '',
    city: 'Pune',
    country: 'India',
    primarySport: 'Football',
    sports: ['Football'],
    skillLevel: 'Advanced',
    isOnline: false,
    badges: [],
    stats: { followers: 0, following: 0, posts: 1, winRate: 0, games: 0 }
  },
  kind: 'highlight',
  sport: 'Football',
  body: 'Match highlight',
  mediaKind: 'video',
  mediaUrl: 'https://cdn.example.com/highlight.mp4',
  mediaPlaceholder: 'data:image/jpeg;base64,poster',
  likedByMe: false,
  savedByMe: true,
  likes: 1,
  comments: 2,
  shares: 3,
  createdAt: '2026-07-30T10:00:00.000Z',
  ...overrides
});

describe('PostCard feed video', () => {
  it('starts supported videos in app without opening the external fallback', async () => {
    const onVideoActivate = jest.fn();
    const onMediaPress = jest.fn();
    await render(
      <PostCard
        post={makePost()}
        onVideoActivate={onVideoActivate}
        onMediaPress={onMediaPress}
      />
    );

    expect(screen.queryByTestId('feed-video-post-1')).toBeNull();
    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Play video' }));
    });

    expect(onVideoActivate).toHaveBeenCalledTimes(1);
    expect(onMediaPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('feed-video-post-1')).toBeTruthy();
  });

  it('keeps only the list-selected video mounted', async () => {
    function ControlledFeed() {
      const [activeId, setActiveId] = useState<string | null>(null);
      return (
        <View>
          {['post-1', 'post-2'].map((id) => (
            <PostCard
              key={id}
              post={makePost({ id })}
              isVideoActive={activeId === id}
              onVideoActivate={() => setActiveId(id)}
            />
          ))}
        </View>
      );
    }

    await render(<ControlledFeed />);
    const playButtons = screen.getAllByRole('button', { name: 'Play video' });
    await act(() => {
      fireEvent.press(playButtons[0]);
    });
    expect(screen.getByTestId('feed-video-post-1')).toBeTruthy();
    expect(screen.queryByTestId('feed-video-post-2')).toBeNull();

    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Play video' }));
    });
    expect(screen.queryByTestId('feed-video-post-1')).toBeNull();
    expect(screen.getByTestId('feed-video-post-2')).toBeTruthy();
  });

  it('uses an external fallback only for unsupported video URLs', async () => {
    const onMediaPress = jest.fn();
    await render(
      <PostCard
        post={makePost({ mediaUrl: 'not a valid URL' })}
        onMediaPress={onMediaPress}
      />
    );

    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
    await act(() => {
      fireEvent.press(screen.getByRole('button', { name: 'Open video externally' }));
    });
    expect(onMediaPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('feed-video-post-1')).toBeNull();
  });

  it('does not render an inert overflow control', async () => {
    const { rerender } = await render(<PostCard post={makePost({ mediaKind: 'none' })} />);
    expect(screen.queryByRole('button', { name: 'Post options' })).toBeNull();

    const onMore = jest.fn();
    await rerender(<PostCard post={makePost({ mediaKind: 'none' })} onMore={onMore} />);
    fireEvent.press(screen.getByRole('button', { name: 'Post options' }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});
