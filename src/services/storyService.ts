import AsyncStorage from '@react-native-async-storage/async-storage';

import { stories as mockStories, currentUser } from '@/data/mockData';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { storageService } from '@/services/storageService';
import type { Story, UserProfile } from '@/types/domain';

const localStories = [...mockStories];
const seenStoryIds = new Set(mockStories.filter((story) => story.seen).map((story) => story.id));
const seenStoriesStorageKey = 'sportz.seen-stories';
let seenStoriesLoaded = false;

const loadSeenStories = async () => {
  if (seenStoriesLoaded) return;
  seenStoriesLoaded = true;

  try {
    const savedIds = JSON.parse((await AsyncStorage.getItem(seenStoriesStorageKey)) ?? '[]') as string[];
    savedIds.forEach((id) => seenStoryIds.add(id));
  } catch {
    // Keep the in-memory seen state if persisted data is unavailable.
  }
};

type StoryAuthor = Pick<UserProfile, 'id' | 'displayName' | 'initials'>;

export const storyService = {
  async listStories(): Promise<Story[]> {
    await loadSeenStories();

    if (!env.isSupabaseConfigured) {
      return localStories.map((story) => ({ ...story, seen: seenStoryIds.has(story.id) }));
    }

    const { data, error } = await supabase
      .from('stories')
      .select('id, media_url, created_at, profiles:author_id(id, display_name)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) {
      return localStories.map((story) => ({ ...story, seen: seenStoryIds.has(story.id) }));
    }

    return data.map((row: any) => {
      const displayName = row.profiles?.display_name ?? 'Athlete';

      return {
        id: row.id,
        user: {
          id: row.profiles?.id ?? '',
          displayName,
          initials: displayName
            .split(' ')
            .map((part: string) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        },
        mediaUrl: row.media_url,
        seen: seenStoryIds.has(row.id),
        createdAt: row.created_at
      };
    });
  },

  async createStory(mediaUri: string, author: StoryAuthor = currentUser): Promise<Story> {
    if (!env.isSupabaseConfigured) {
      const story: Story = {
        id: `local-story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user: author,
        mediaUrl: mediaUri,
        seen: false,
        createdAt: new Date().toISOString()
      };
      localStories.unshift(story);
      return story;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create a story.');

    const mediaUrl = await storageService.uploadMedia(mediaUri, 'story-media', authData.user.id);
    const { data, error } = await supabase
      .from('stories')
      .insert({
        author_id: authData.user.id,
        media_url: mediaUrl,
        media_kind: 'image'
      })
      .select('id, media_url, created_at')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user: author,
      mediaUrl: data.media_url,
      seen: false,
      createdAt: data.created_at
    };
  },

  async createStories(mediaUris: string[], author: StoryAuthor = currentUser): Promise<Story[]> {
    const createdStories: Story[] = [];
    for (const mediaUri of mediaUris) {
      createdStories.push(await storyService.createStory(mediaUri, author));
    }

    if (!env.isSupabaseConfigured) {
      const createdIds = new Set(createdStories.map((story) => story.id));
      const existingStories = localStories.filter((story) => !createdIds.has(story.id));
      localStories.splice(0, localStories.length, ...createdStories, ...existingStories);
    }

    return createdStories;
  },

  async markSeen(storyId: string) {
    seenStoryIds.add(storyId);
    try {
      await AsyncStorage.setItem(seenStoriesStorageKey, JSON.stringify([...seenStoryIds]));
    } catch {
      // The in-memory state still keeps the rail accurate for the current session.
    }
  }
};
