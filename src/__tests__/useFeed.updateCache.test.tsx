import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Post } from '@/types/domain';

const mockUpdatePost = jest.fn();
const mockTogglePostSave = jest.fn();
const mockRecordPostShare = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {}
}));

jest.mock('@/services/postService', () => ({
  postService: {
    updatePost: (...args: unknown[]) => mockUpdatePost(...args),
    togglePostSave: (...args: unknown[]) => mockTogglePostSave(...args),
    recordPostShare: (...args: unknown[]) => mockRecordPostShare(...args)
  }
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'viewer-1' } })
}));

// eslint-disable-next-line import/first
import { feedKeys, useOptimisticPostSave, useRecordPostShare, useUpdatePost } from '@/hooks/useFeed';

const originalPost: Post = {
  id: 'post-1',
  author: {
    id: 'author-1',
    username: 'asha',
    displayName: 'Asha',
    initials: 'AS',
    bio: '',
    city: '',
    country: '',
    primarySport: 'Basketball',
    sports: ['Basketball'],
    skillLevel: 'Intermediate',
    isOnline: false,
    badges: [],
    stats: {
      followers: 0,
      following: 0,
      posts: 1,
      winRate: 0,
      games: 0
    }
  },
  communityId: 'community-1',
  kind: 'post',
  sport: 'Basketball',
  body: 'Before',
  mediaUrl: 'https://example.test/before.jpg',
  mediaKind: 'image',
  visibility: 'group',
  likedByMe: false,
  savedByMe: true,
  likes: 0,
  comments: 0,
  shares: 0,
  createdAt: '2026-07-01T00:00:00.000Z'
};

describe('useUpdatePost cache synchronization', () => {
  it('patches Feed, Profile, Saved Posts, Post Detail, and community caches', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity }
      }
    });
    const updatedPost: Post = {
      ...originalPost,
      body: 'After',
      mediaUrl: null,
      mediaKind: 'none',
      locationLabel: 'Central Court'
    };
    mockUpdatePost.mockResolvedValue(updatedPost);

    const infiniteKey = feedKeys.infinite('viewer-1');
    queryClient.setQueryData(infiniteKey, {
      pages: [{ items: [originalPost], nextCursor: undefined }],
      pageParams: [undefined]
    });
    queryClient.setQueryData(feedKeys.userPosts('author-1'), [originalPost]);
    queryClient.setQueryData(feedKeys.savedPosts, [originalPost]);
    queryClient.setQueryData(feedKeys.communityPosts('community-1'), {
      pages: [{ items: [originalPost], nextCursor: undefined }],
      pageParams: [undefined]
    });
    queryClient.setQueryData(feedKeys.post('post-1'), originalPost);

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(() => useUpdatePost(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        postId: 'post-1',
        input: { body: 'After', sport: 'Basketball', removeMedia: true }
      });
    });

    const infinite = queryClient.getQueryData<{
      pages: { items: Post[] }[];
    }>(infiniteKey);
    expect(infinite?.pages[0].items[0]).toEqual(updatedPost);
    expect(queryClient.getQueryData<Post[]>(feedKeys.userPosts('author-1'))?.[0]).toEqual(updatedPost);
    expect(queryClient.getQueryData<Post[]>(feedKeys.savedPosts)?.[0]).toEqual(updatedPost);
    expect(queryClient.getQueryData<{ pages: { items: Post[] }[] }>(
      feedKeys.communityPosts('community-1')
    )?.pages[0].items[0]).toEqual(updatedPost);
    expect(queryClient.getQueryData<Post>(feedKeys.post('post-1'))).toEqual(updatedPost);
    await unmount();
    queryClient.clear();
  });

  it('rolls back failed saves in community, Feed, Profile, Saved Posts, and Post Detail caches', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity }
      }
    });
    mockTogglePostSave.mockRejectedValue(new Error('save failed'));
    const communityKey = feedKeys.communityPosts('community-1');
    const infiniteKey = feedKeys.infinite('viewer-1');
    const page = { pages: [{ items: [originalPost], nextCursor: undefined }], pageParams: [undefined] };
    queryClient.setQueryData(communityKey, page);
    queryClient.setQueryData(infiniteKey, page);
    queryClient.setQueryData(feedKeys.userPosts('author-1'), [originalPost]);
    queryClient.setQueryData(feedKeys.savedPosts, [originalPost]);
    queryClient.setQueryData(feedKeys.post('post-1'), originalPost);

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(() => useOptimisticPostSave(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ postId: 'post-1', saved: true })).rejects.toThrow('save failed');
    });

    expect(queryClient.getQueryData<typeof page>(communityKey)?.pages[0].items[0].savedByMe).toBe(true);
    expect(queryClient.getQueryData<typeof page>(infiniteKey)?.pages[0].items[0].savedByMe).toBe(true);
    expect(queryClient.getQueryData<Post[]>(feedKeys.userPosts('author-1'))?.[0].savedByMe).toBe(true);
    expect(queryClient.getQueryData<Post[]>(feedKeys.savedPosts)).toEqual([originalPost]);
    expect(queryClient.getQueryData<Post>(feedKeys.post('post-1'))?.savedByMe).toBe(true);
    await unmount();
    queryClient.clear();
  });

  it('synchronizes successful optimistic share counts across community and detail caches', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity }
      }
    });
    mockRecordPostShare.mockResolvedValue(undefined);
    const communityKey = feedKeys.communityPosts('community-1');
    const page = { pages: [{ items: [originalPost], nextCursor: undefined }], pageParams: [undefined] };
    queryClient.setQueryData(communityKey, page);
    queryClient.setQueryData(feedKeys.post('post-1'), originalPost);
    queryClient.setQueryData(feedKeys.savedPosts, [originalPost]);

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(() => useRecordPostShare(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('post-1');
    });

    expect(queryClient.getQueryData<typeof page>(communityKey)?.pages[0].items[0].shares).toBe(1);
    expect(queryClient.getQueryData<Post>(feedKeys.post('post-1'))?.shares).toBe(1);
    expect(queryClient.getQueryData<Post[]>(feedKeys.savedPosts)?.[0].shares).toBe(1);
    await unmount();
    queryClient.clear();
  });
});
