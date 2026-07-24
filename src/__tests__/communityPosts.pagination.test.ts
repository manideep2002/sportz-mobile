import type { Post } from '@/types/domain';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/services/postService', () => ({ postService: {} }));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'viewer-1' } })
}));

// eslint-disable-next-line import/first
import { flattenCommunityPostPages } from '@/hooks/useFeed';

const makePost = (id: string): Post => ({
  id,
  author: {
    id: 'author-1', username: 'asha', displayName: 'Asha', initials: 'AS',
    bio: '', city: '', country: '', primarySport: 'Basketball', sports: ['Basketball'],
    skillLevel: 'Intermediate', isOnline: false, badges: [],
    stats: { followers: 0, following: 0, posts: 1, winRate: 0, games: 0 }
  },
  kind: 'post', sport: 'Basketball', body: id, visibility: 'group',
  likedByMe: false, savedByMe: false, likes: 0, comments: 0, shares: 0,
  createdAt: '2026-07-24T00:00:00.000Z'
});

describe('community post pagination', () => {
  it('deduplicates posts that overlap cursor page boundaries while retaining later posts', () => {
    const data = {
      pages: [
        { items: [makePost('1'), makePost('2'), makePost('3')], nextCursor: 'cursor-2' },
        { items: [makePost('3'), makePost('4'), makePost('5')], nextCursor: undefined }
      ]
    };

    expect(flattenCommunityPostPages(data).map((post) => post.id)).toEqual(['1', '2', '3', '4', '5']);
  });
});
