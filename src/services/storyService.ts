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

type StoryAuthor = Pick<UserProfile, 'id' | 'displayName' | 'initials' | 'avatarUrl' | 'skillLevel'>;

type StoryProfileRow = {
  id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  skill_level: string | null;
};

export interface StoryRow {
  id: string;
  media_url: string | null;
  media_kind?: 'image' | 'video' | null;
  body: string | null;
  created_at: string;
  profiles: StoryProfileRow | StoryProfileRow[] | null;
}

export function mapStoryRow(
  row: StoryRow,
  seen = false,
  fallbackAuthor?: StoryAuthor
): Story {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const displayName = profile?.display_name ?? fallbackAuthor?.displayName ?? 'Athlete';

  return {
    id: row.id,
    user: {
      id: profile?.id ?? fallbackAuthor?.id ?? '',
      displayName,
      initials: profile?.display_name
        ? initialsForName(profile.display_name)
        : fallbackAuthor?.initials ?? initialsForName(displayName),
      avatarUrl: profile?.avatar_url ?? fallbackAuthor?.avatarUrl ?? null,
      skillLevel:
        (profile?.skill_level as UserProfile['skillLevel']) ??
        fallbackAuthor?.skillLevel ??
        'Intermediate'
    },
    mediaUrl: row.media_url,
    mediaKind: row.media_kind ?? 'image',
    body: row.body,
    seen,
    createdAt: row.created_at
  };
}

export const storyService = {
  async clearSeenState(): Promise<void> {
    seenStoryIds.clear();
    seenStoriesLoaded = false;
    try {
      await AsyncStorage.removeItem(seenStoriesStorageKey);
    } catch {
      // In-memory state is still cleared even when device storage is unavailable.
    }
  },

  async listStories(): Promise<Story[]> {
    assertSupabaseConfigured();
    await loadSeenStories();

    const { data, error } = await supabase
      .from('stories')
      .select('id, media_url, media_kind, body, created_at, profiles:author_id(id, display_name, avatar_url, skill_level)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const storyRow = row as unknown as StoryRow;
      return mapStoryRow(storyRow, seenStoryIds.has(storyRow.id));
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
      .select('id, media_url, media_kind, body, created_at, profiles:author_id(id, display_name, avatar_url, skill_level)')
      .single();

    if (error) throw error;

    const fallbackAuthor: StoryAuthor = {
      id: authData.user.id,
      displayName: author?.displayName ?? 'Athlete',
      initials: author?.initials ?? initialsForName(author?.displayName),
      avatarUrl: author?.avatarUrl ?? null,
      skillLevel: author?.skillLevel ?? 'Intermediate'
    };
    const storyRow = data as unknown as StoryRow;

    return {
      ...mapStoryRow(storyRow, false, fallbackAuthor),
      mediaKind: storyRow.media_kind ?? (asset.type === 'video' ? 'video' : 'image')
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

    assertSupabaseConfigured();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { error } = await supabase.from('story_views').upsert(
      {
        story_id: storyId,
        viewer_id: authData.user.id,
        viewed_at: new Date().toISOString()
      },
      { onConflict: 'story_id,viewer_id' }
    );
    if (error && error.code !== '42P01') throw error;
  },

  async recordReaction(storyId: string, reaction: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to react to stories.');

    const { error } = await supabase.from('story_reactions').insert({
      story_id: storyId,
      user_id: authData.user.id,
      reaction
    });
    if (error && error.code !== '23505' && error.code !== '42P01') throw error;
  },

  async recordReply(storyId: string, body: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to reply to stories.');

    const { error } = await supabase.from('story_replies').insert({
      story_id: storyId,
      user_id: authData.user.id,
      body
    });
    if (error && error.code !== '42P01') throw error;
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
