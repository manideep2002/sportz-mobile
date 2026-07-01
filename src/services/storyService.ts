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

type StoryAuthor = Pick<UserProfile, 'id' | 'displayName' | 'initials' | 'avatarUrl'>;

/** Shape of a raw story row returned from the DB. */
interface StoryRow {
  id: string;
  media_url: string | null;
  body: string | null;
  created_at: string;
  profiles: { id: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export const storyService = {
  async listStories(): Promise<Story[]> {
    assertSupabaseConfigured();
    await loadSeenStories();

    const { data, error } = await supabase
      .from('stories')
      .select('id, media_url, body, created_at, profiles:author_id(id, display_name, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const storyRow = row as unknown as StoryRow;
      const displayName = storyRow.profiles?.display_name ?? 'Athlete';

      return {
        id: storyRow.id,
        user: {
          id: storyRow.profiles?.id ?? '',
          displayName,
          initials: initialsForName(displayName),
          avatarUrl: storyRow.profiles?.avatar_url ?? null
        },
        mediaUrl: storyRow.media_url,
        body: storyRow.body,
        seen: seenStoryIds.has(storyRow.id),
        createdAt: storyRow.created_at
      };
    });
  },

  async createStory(asset: ImagePickerAsset, author?: StoryAuthor, body?: string): Promise<Story> {
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
        media_kind: asset.type === 'video' ? 'video' : 'image',
        body: body?.trim() || null
      })
      .select('id, media_url, body, created_at, profiles:author_id(id, display_name, avatar_url)')
      .single();

    if (error) throw error;

    // profiles is returned as an array from the select query
    const profileResult = data as unknown as { id: string; media_url: string | null; created_at: string; profiles: StoryRow['profiles'] | StoryRow['profiles'][] };
    const profile = Array.isArray(profileResult.profiles) ? profileResult.profiles[0] : profileResult.profiles;
    const displayName = profile?.display_name ?? author?.displayName ?? 'Athlete';

    return {
      id: data.id,
      user: {
        id: profile?.id ?? authData.user.id,
        displayName,
        initials: profile?.display_name ? initialsForName(profile.display_name) : author?.initials ?? initialsForName(displayName),
        avatarUrl: profile?.avatar_url ?? author?.avatarUrl ?? null
      },
      mediaUrl: (data as unknown as StoryRow).media_url,
      body: (data as unknown as StoryRow).body,
      seen: false,
      createdAt: data.created_at
    };
  },

  async createStories(assets: ImagePickerAsset[], author?: StoryAuthor, body?: string): Promise<Story[]> {
    const createdStories: Story[] = [];
    for (const asset of assets) {
      createdStories.push(await storyService.createStory(asset, author, body));
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
