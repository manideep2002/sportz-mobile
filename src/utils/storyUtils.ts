import type { Story, UserProfile } from '@/types/domain';

export interface UserStoriesGroup {
  userId: string;
  user: Pick<UserProfile, 'id' | 'displayName' | 'initials' | 'avatarUrl' | 'skillLevel'>;
  stories: Story[];
  allSeen: boolean;
}

/**
 * Groups raw stories by user ID and performs sorting:
 * 1. Inside each group, stories are sorted chronologically (oldest first).
 * 2. User groups themselves are sorted: unseen groups first, then fully seen groups.
 * 3. Within seen/unseen categories, groups are sorted by the latest story's creation date (newest first).
 */
export function groupStoriesByUser(stories: Story[]): UserStoriesGroup[] {
  const groupsMap = new Map<string, Story[]>();

  stories.forEach((story) => {
    if (!story.user || !story.user.id) return;
    const userId = story.user.id;
    if (!groupsMap.has(userId)) {
      groupsMap.set(userId, []);
    }
    groupsMap.get(userId)!.push(story);
  });

  const groups: UserStoriesGroup[] = [];
  groupsMap.forEach((userStories, userId) => {
    // Sort stories of this user chronologically (oldest first)
    const sortedStories = [...userStories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const user = sortedStories[0].user;
    const allSeen = sortedStories.every((s) => s.seen);
    groups.push({
      userId,
      user,
      stories: sortedStories,
      allSeen
    });
  });

  // Sort groups: users with unseen stories first, followed by seen.
  // Within seen/unseen categories, sort by latest story's createdAt descending.
  groups.sort((a, b) => {
    if (a.allSeen !== b.allSeen) {
      return a.allSeen ? 1 : -1;
    }
    const latestA = new Date(a.stories[a.stories.length - 1].createdAt).getTime();
    const latestB = new Date(b.stories[b.stories.length - 1].createdAt).getTime();
    return latestB - latestA;
  });

  return groups;
}
