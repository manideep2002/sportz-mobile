import { render, screen } from '@testing-library/react-native';

import { StoryRail } from '@/components/feed/StoryRail';
import type { Story } from '@/types/domain';

jest.mock('@/components/ui', () => require('@/test/mockUi'));

const makeStory = (seen: boolean): Story => ({
  id: seen ? 'story-seen' : 'story-unseen',
  user: {
    id: 'user-1',
    displayName: 'Asha Singh',
    initials: 'AS',
    avatarUrl: null,
    skillLevel: 'Advanced'
  },
  mediaUrl: 'https://example.test/story.jpg',
  mediaKind: 'image',
  seen,
  createdAt: '2026-07-25T10:00:00.000Z'
});

describe('StoryRail', () => {
  it('renders a visible accent ring for a user with an unseen story', async () => {
    await render(
      <StoryRail stories={[makeStory(false)]} onCreateStory={jest.fn()} onOpenStory={jest.fn()} />
    );

    expect(screen.getByTestId('story-ring-user-1')).toHaveStyle({
      borderWidth: 2,
      borderColor: '#FF5A1F'
    });
  });

  it('renders a subdued ring once every story has been seen', async () => {
    await render(
      <StoryRail stories={[makeStory(true)]} onCreateStory={jest.fn()} onOpenStory={jest.fn()} />
    );

    expect(screen.getByTestId('story-ring-user-1')).toHaveStyle({
      borderWidth: 2,
      borderColor: '#2A2420'
    });
  });
});
