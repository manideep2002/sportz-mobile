import { groupStoriesByUser } from '@/utils/storyUtils';
import type { Story } from '@/types/domain';

describe('groupStoriesByUser', () => {
  const user1 = { id: 'u1', displayName: 'User One', initials: 'UO', skillLevel: 'Intermediate' as const };
  const user2 = { id: 'u2', displayName: 'User Two', initials: 'UT', skillLevel: 'Advanced' as const };
  const user3 = { id: 'u3', displayName: 'User Three', initials: 'UT', skillLevel: 'Beginner' as const };

  it('groups multiple stories by user ID', () => {
    const stories: Story[] = [
      { id: 's1', user: user1, mediaUrl: 'url1', seen: false, createdAt: '2026-07-14T10:00:00Z' },
      { id: 's2', user: user2, mediaUrl: 'url2', seen: false, createdAt: '2026-07-14T11:00:00Z' },
      { id: 's3', user: user1, mediaUrl: 'url3', seen: false, createdAt: '2026-07-14T12:00:00Z' },
    ];

    const grouped = groupStoriesByUser(stories);
    expect(grouped).toHaveLength(2);

    const group1 = grouped.find((g) => g.userId === 'u1');
    const group2 = grouped.find((g) => g.userId === 'u2');

    expect(group1).toBeDefined();
    expect(group1!.stories).toHaveLength(2);
    expect(group2).toBeDefined();
    expect(group2!.stories).toHaveLength(1);
  });

  it('sorts stories within each group chronologically (oldest first)', () => {
    const stories: Story[] = [
      { id: 's3', user: user1, mediaUrl: 'url3', seen: false, createdAt: '2026-07-14T12:00:00Z' },
      { id: 's1', user: user1, mediaUrl: 'url1', seen: false, createdAt: '2026-07-14T10:00:00Z' },
      { id: 's2', user: user1, mediaUrl: 'url2', seen: false, createdAt: '2026-07-14T11:00:00Z' },
    ];

    const grouped = groupStoriesByUser(stories);
    expect(grouped[0].stories.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('prioritizes unseen groups and sorts categories by the latest story date descending', () => {
    const stories: Story[] = [
      // user1 (fully seen) - latest story at 12:00
      { id: 's1', user: user1, mediaUrl: 'url1', seen: true, createdAt: '2026-07-14T10:00:00Z' },
      { id: 's3', user: user1, mediaUrl: 'url3', seen: true, createdAt: '2026-07-14T12:00:00Z' },

      // user2 (partially unseen) - latest story at 11:00
      { id: 's2', user: user2, mediaUrl: 'url2', seen: true, createdAt: '2026-07-14T09:00:00Z' },
      { id: 's4', user: user2, mediaUrl: 'url4', seen: false, createdAt: '2026-07-14T11:00:00Z' },

      // user3 (fully unseen) - latest story at 10:30
      { id: 's5', user: user3, mediaUrl: 'url5', seen: false, createdAt: '2026-07-14T10:30:00Z' },
    ];

    const grouped = groupStoriesByUser(stories);

    // Unseen groups should come first: u2 and u3
    // Within unseen:
    // u2's latest story is 2026-07-14T11:00:00Z
    // u3's latest story is 2026-07-14T10:30:00Z
    // So u2 should be before u3.
    // Fully seen group (u1) should be last.
    expect(grouped.map((g) => g.userId)).toEqual(['u2', 'u3', 'u1']);
  });
});
