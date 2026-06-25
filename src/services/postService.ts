import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import { profileService } from '@/services/profileService';
import { storageService } from '@/services/storageService';
import type { Comment, Post } from '@/types/domain';

export interface CreatePostInput {
  body: string;
  sport: string;
  kind?: Post['kind'];
  mediaUrl?: string | null;
  mediaKind?: Post['mediaKind'];
  statsLine?: string;
  visibility?: 'public' | 'followers' | 'group';
}

export interface FeedPage {
  items: Post[];
  nextCursor?: string;
}

interface PostEngagement {
  likes: Map<string, number>;
  comments: Map<string, number>;
  likedByMe: Set<string>;
  savedByMe: Set<string>;
}

const mapPostRow = (row: any, engagement: PostEngagement): Post => ({
  id: row.id,
  author: mapProfileRow(row.profiles ?? row.profile ?? {
    id: row.author_id,
    display_name: row.display_name,
    username: row.username,
    avatar_url: row.avatar_url
  }),
  kind: row.kind ?? 'post',
  sport: row.sport ?? 'Basketball',
  body: row.body,
  mediaUrl: row.media_url,
  mediaKind: row.media_kind ?? 'none',
  statsLine: row.stats_line ?? undefined,
  likedByMe: engagement.likedByMe.has(row.id),
  savedByMe: engagement.savedByMe.has(row.id),
  likes: engagement.likes.get(row.id) ?? row.likes_count ?? 0,
  comments: engagement.comments.get(row.id) ?? row.comments_count ?? 0,
  shares: 0,
  createdAt: row.created_at
});

const emptyEngagement = (): PostEngagement => ({
  likes: new Map(),
  comments: new Map(),
  likedByMe: new Set(),
  savedByMe: new Set()
});

const loadPostEngagement = async (postIds: string[]): Promise<PostEngagement> => {
  const engagement = emptyEngagement();
  if (!postIds.length) return engagement;

  const [{ data: authData }, likesResult, commentsResult, savesResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('likes').select('entity_id, user_id').eq('entity_type', 'post').in('entity_id', postIds),
    supabase.from('comments').select('post_id').in('post_id', postIds),
    supabase.from('saved_posts').select('post_id, user_id').in('post_id', postIds)
  ]);

  if (likesResult.error) throw likesResult.error;
  if (commentsResult.error) throw commentsResult.error;
  if (savesResult.error) throw savesResult.error;

  for (const like of likesResult.data ?? []) {
    engagement.likes.set(like.entity_id, (engagement.likes.get(like.entity_id) ?? 0) + 1);
    if (authData.user?.id === like.user_id) engagement.likedByMe.add(like.entity_id);
  }
  for (const comment of commentsResult.data ?? []) {
    engagement.comments.set(comment.post_id, (engagement.comments.get(comment.post_id) ?? 0) + 1);
  }
  for (const save of savesResult.data ?? []) {
    if (authData.user?.id === save.user_id) engagement.savedByMe.add(save.post_id);
  }

  return engagement;
};

export const postService = {
  async listUserPosts(userId: string): Promise<Post[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const engagement = await loadPostEngagement((data ?? []).map((row: any) => row.id));
    return (data ?? []).map((row: any) => mapPostRow(row, engagement));
  },

  async listCommunityPosts(communityId: string): Promise<Post[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const engagement = await loadPostEngagement((data ?? []).map((row: any) => row.id));
    return (data ?? []).map((row: any) => mapPostRow(row, engagement));
  },

  async listFeedPage(cursor?: string, limit = 10): Promise<FeedPage> {
    assertSupabaseConfigured();

    let request = supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      request = request.lt('created_at', cursor);
    }

    const { data, error } = await request;
    if (error) throw error;

    const engagement = await loadPostEngagement((data ?? []).map((row: any) => row.id));
    const items = (data ?? []).map((row: any) => mapPostRow(row, engagement));

    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1].createdAt : undefined
    };
  },

  async getPost(postId: string): Promise<Post> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .eq('id', postId)
      .single();
    if (error) throw error;

    const engagement = await loadPostEngagement([data.id]);
    return mapPostRow(data, engagement);
  },

  async createPost(input: CreatePostInput): Promise<Post> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to post.');

    const mediaUrl = input.mediaUrl
      ? await storageService.uploadMedia(input.mediaUrl, 'post-media', authData.user.id)
      : null;

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: authData.user.id,
        kind: input.kind ?? 'post',
        sport: input.sport,
        body: input.body,
        media_url: mediaUrl,
        media_kind: input.mediaKind ?? (mediaUrl ? 'image' : 'none'),
        stats_line: input.statsLine ?? null,
        visibility: input.visibility ?? 'public'
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) throw error;

    return mapPostRow(data, emptyEngagement());
  },

  async listComments(postId: string): Promise<Comment[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles:author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      postId: row.post_id,
      author: mapProfileRow(row.profiles ?? { id: row.author_id }),
      body: row.body,
      likes: 0,
      createdAt: row.created_at
    }));
  },

  async createComment(postId: string, body: string): Promise<Comment> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to comment.');

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: authData.user.id,
        body
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      postId: data.post_id,
      author: mapProfileRow(data.profiles ?? { id: data.author_id }),
      body: data.body,
      likes: 0,
      createdAt: data.created_at
    };
  },

  async togglePostLike(postId: string, liked: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to like posts.');

    if (liked) {
      const { error } = await supabase.from('likes').delete().match({
        user_id: authData.user.id,
        entity_type: 'post',
        entity_id: postId
      });
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('likes').insert({
      user_id: authData.user.id,
      entity_type: 'post',
      entity_id: postId
    });
    if (error && error.code !== '23505') throw error;
  },

  async togglePostSave(postId: string, saved: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to save posts.');

    if (saved) {
      const { error } = await supabase.from('saved_posts').delete().match({
        user_id: authData.user.id,
        post_id: postId
      });
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('saved_posts').insert({
      user_id: authData.user.id,
      post_id: postId
    });
    if (error && error.code !== '23505') throw error;
  },

  async deletePost(postId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to delete posts.');

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (fetchError) throw fetchError;
    if (post.author_id !== authData.user.id) {
      throw new Error('You can only delete your own posts.');
    }

    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw error;
  }
};
