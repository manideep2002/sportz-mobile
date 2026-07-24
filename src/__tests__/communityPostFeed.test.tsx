import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Post } from '@/types/domain';

const mockNavigate = jest.fn();
const mockSave = jest.fn();
const mockShareCount = jest.fn();
const mockDelete = jest.fn();
const mockSharePost = jest.fn(() => Promise.resolve());
const mockOpenMedia = jest.fn(() => Promise.resolve());

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string }; profile: { id: string } }) => unknown) =>
    selector({ user: { id: 'author-1' }, profile: { id: 'author-1' } })
}));
jest.mock('@/hooks/useFeed', () => ({
  useOptimisticPostSave: () => ({ mutate: mockSave }),
  useRecordPostShare: () => ({ mutate: mockShareCount }),
  useDeletePost: () => ({ mutate: mockDelete })
}));
jest.mock('@/services/reportService', () => ({
  reportReasons: ['Spam'],
  reportService: { reportEntity: jest.fn() }
}));
jest.mock('@/utils/share', () => ({
  sharePost: (...args: unknown[]) => mockSharePost(...args),
  openPostMedia: (...args: unknown[]) => mockOpenMedia(...args)
}));
jest.mock('@/components/feed/PostCard', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    PostCard: (props: Record<string, any>) => React.createElement(View, null,
      React.createElement(Text, null, props.post.id),
      ...['onPress', 'onAuthorPress', 'onComment', 'onShare', 'onSave', 'onMediaPress', 'onMore']
        .map((name) => React.createElement(
          Pressable,
          { key: name, accessibilityRole: 'button', accessibilityLabel: `${name}-${props.post.id}`, onPress: props[name] },
          React.createElement(Text, null, name)
        ))
    )
  };
});
jest.mock('@/components/feed/PostOptionsSheet', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    PostOptionsSheet: (props: Record<string, any>) => props.open
      ? React.createElement(View, null,
        React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'edit-post', onPress: props.onEdit }, React.createElement(Text, null, 'Edit')),
        React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'delete-post', onPress: props.onDelete }, React.createElement(Text, null, 'Delete')))
      : null
  };
});

// eslint-disable-next-line import/first
import { CommunityPostFeed } from '@/components/community/CommunityPostFeed';

const post: Post = {
  id: 'post-1',
  communityId: 'community-1',
  author: {
    id: 'author-1', username: 'asha', displayName: 'Asha', initials: 'AS',
    bio: '', city: '', country: '', primarySport: 'Basketball', sports: ['Basketball'],
    skillLevel: 'Intermediate', isOnline: false, badges: [],
    stats: { followers: 0, following: 0, posts: 1, winRate: 0, games: 0 }
  },
  kind: 'post', sport: 'Basketball', body: 'Community update',
  mediaUrl: 'https://example.test/video.mp4', mediaKind: 'video', visibility: 'group',
  likedByMe: false, savedByMe: false, likes: 0, comments: 0, shares: 0,
  createdAt: '2026-07-24T00:00:00.000Z'
};

const renderFeed = (overrides: Partial<React.ComponentProps<typeof CommunityPostFeed>> = {}) =>
  render(<CommunityPostFeed
    posts={[post]}
    emptyMessage="No posts"
    isLoading={false}
    isError={false}
    onRetry={jest.fn()}
    hasNextPage
    isFetchingNextPage={false}
    isFetchNextPageError={false}
    onLoadMore={jest.fn()}
    {...overrides}
  />);

describe('community page/group post interactions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('connects comment, post, author, share, save, media, edit, and delete actions', async () => {
    await renderFeed();
    await fireEvent.press(screen.getByRole('button', { name: 'onPress-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'onComment-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'onAuthorPress-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'onShare-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'onSave-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'onMediaPress-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'onMore-post-1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'edit-post' }));
    await fireEvent.press(screen.getByRole('button', { name: 'delete-post' }));

    expect(mockNavigate).toHaveBeenCalledWith('PostDetail', { postId: 'post-1' });
    expect(mockNavigate).toHaveBeenCalledWith('UserProfile', { userId: 'author-1' });
    expect(mockSave).toHaveBeenCalledWith({ postId: 'post-1', saved: false });
    expect(mockOpenMedia).toHaveBeenCalledWith(post);
    expect(mockNavigate).toHaveBeenCalledWith('CreatePost', {
      editPostId: 'post-1',
      communityId: 'community-1'
    });
    expect(mockDelete).toHaveBeenCalledWith('post-1');
    await waitFor(() => expect(mockShareCount).toHaveBeenCalledWith('post-1'));
  });

  it('renders all deduplicated pages supplied by page/group screens and exposes load-more/end states', async () => {
    const onLoadMore = jest.fn();
    const posts = [post, ...[2, 3, 4, 5].map((id) => ({ ...post, id: `post-${id}` }))];
    const { rerender } = await renderFeed({ posts, onLoadMore });
    expect(screen.getByText('post-5')).toBeTruthy();
    await fireEvent.press(screen.getByText('Load More Posts'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await rerender(<CommunityPostFeed
      posts={posts}
      emptyMessage="No posts"
      isLoading={false}
      isError={false}
      onRetry={jest.fn()}
      hasNextPage={false}
      isFetchingNextPage={false}
      isFetchNextPageError={false}
      onLoadMore={onLoadMore}
    />);
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });
});
