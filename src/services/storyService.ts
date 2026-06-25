import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { initialsForName } from '@/services/profileMapper';
import { storageService } from '@/services/storageService';
import type { Story, UserProfile } from '@/types/domain';

const seenStoryIds = new Set<string>();
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
    assertSupabaseConfigured();
    await loadSeenStories();

    const { data, error } = await supabase
      .from('stories')
      .select('id, media_url, created_at, profiles:author_id(id, display_name)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => {
      const displayName = row.profiles?.display_name ?? 'Athlete';

      return {
        id: row.id,
        user: {
          id: row.profiles?.id ?? '',
          displayName,
          initials: initialsForName(displayName)
        },
        mediaUrl: row.media_url,
        seen: seenStoryIds.has(row.id),
        createdAt: row.created_at
      };
    });
  },

  async createStory(asset: ImagePickerAsset, author?: StoryAuthor): Promise<Story> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create a story.');

    const mediaUrl = await storageService.uploadMedia(asset, 'story-media', authData.user.id);
    const { data, error } = await supabase
      .from('stories')
      .insert({
        author_id: authData.user.id,
        media_url: mediaUrl,
        media_kind: asset.type === 'video' ? 'video' : 'image'
      })
      .select('id, media_url, created_at, profiles:author_id(id, display_name)')
      .single();

    if (error) throw error;

    const displayName = data.profiles?.display_name ?? author?.displayName ?? 'Athlete';

    return {
      id: data.id,
      user: {
        id: data.profiles?.id ?? authData.user.id,
        displayName,
        initials: data.profiles?.display_name ? initialsForName(data.profiles.display_name) : author?.initials ?? initialsForName(displayName)
      },
      mediaUrl: data.media_url,
      seen: false,
      createdAt: data.created_at
    };
  },

  async createStories(assets: ImagePickerAsset[], author?: StoryAuthor): Promise<Story[]> {
    const createdStories: Story[] = [];
    for (const asset of assets) {
      createdStories.push(await storyService.createStory(asset, author));
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
  },

  async deleteStory(storyId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to delete a story.');

    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)
      .eq('author_id', authData.user.id);

    if (error) throw error;
  }
};
