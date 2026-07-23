import { mapStoryRow, type StoryRow } from '@/services/storyService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/services/storageService', () => ({ storageService: {} }));

const row = (mediaKind?: StoryRow['media_kind']): StoryRow => ({
  id: 'story-1',
  media_url: 'https://example.com/story.mp4',
  ...(mediaKind === undefined ? {} : { media_kind: mediaKind }),
  body: null,
  created_at: '2026-07-23T10:00:00.000Z',
  profiles: {
    id: 'user-1',
    display_name: 'Asha Singh',
    avatar_url: null,
    skill_level: 'Advanced'
  }
});

describe('story media kind mapping', () => {
  it('maps media_kind from the database row', () => {
    expect(mapStoryRow(row('video')).mediaKind).toBe('video');
  });

  it('defaults missing media_kind to image', () => {
    expect(mapStoryRow(row()).mediaKind).toBe('image');
  });
});
