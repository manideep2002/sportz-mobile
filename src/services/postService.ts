import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { comments, currentUser, posts } from '@/data/mockData';
import type { Comment, Post } from '@/types/domain';

export interface CreatePostInput {
  body: string;
  sport: string;
  kind?: Post['kind'];
  mediaUrl?: string | null;
  mediaKind?: Post['mediaKind'];
  visibility?: 'public' | 'followers' | 'group';
}

export interface FeedPage {
  items: Post[];
  nextCursor?: string;
}

export const postService = {
  async listUserPosts(userId: string): Promise<Post[]> {
    if (!env.isSupabaseConfigured) {
      return posts.filter((post) => post.author.id === userId);
    }

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return posts.filter((post) => post.author.id === userId);

    return data.map((row: any) => ({
      id: row.id,
      author: {
        ...currentUser,
        id: row.profiles?.id ?? row.author_id,
        displayName: row.profiles?.display_name ?? 'Athlete',
        username: row.profiles?.username ?? 'athlete',
        initials: (row.profiles?.display_name ?? 'AT')
          .split(' ')
          .map((part: string) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      },
      kind: row.kind,
      sport: row.sport ?? 'Basketball',
      body: row.body,
      mediaUrl: row.media_url,
      mediaKind: row.media_kind ?? 'none',
      statsLine: row.stats_line,
      likedByMe: false,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: row.created_at
    })) satisfies Post[];
  },

  async listFeedPage(cursor?: string, limit = 10): Promise<FeedPage> {
    if (!env.isSupabaseConfigured) {
      const start = cursor ? Number(cursor) : 0;
      const items = posts.slice(start, start + limit);
      const next = start + limit < posts.length ? String(start + limit) : undefined;
      return { items, nextCursor: next };
    }

    let request = supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      request = request.lt('created_at', cursor);
    }

    const { data, error } = await request;
    if (error || !data) return { items: posts, nextCursor: undefined };

    const items = data.map((row: any) => ({
      id: row.id,
      author: {
        ...currentUser,
        id: row.profiles?.id ?? row.author_id,
        displayName: row.profiles?.display_name ?? 'Athlete',
        username: row.profiles?.username ?? 'athlete',
        initials: (row.profiles?.display_name ?? 'AT')
          .split(' ')
          .map((part: string) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      },
      kind: row.kind,
      sport: row.sport ?? 'Basketball',
      body: row.body,
      mediaUrl: row.media_url,
      mediaKind: row.media_kind ?? 'none',
      statsLine: row.stats_line,
      likedByMe: false,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: row.created_at
    })) satisfies Post[];

    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1].createdAt : undefined
    };
  },

  async getPost(postId: string): Promise<Post> {
    const localPost = posts.find((post) => post.id === postId) ?? posts[0];
    if (!env.isSupabaseConfigured) return localPost;

    const { data, error } = await supabase.from('posts').select('*, profiles:author_id(*)').eq('id', postId).single();
    if (error || !data) return localPost;

    return {
      ...localPost,
      id: data.id,
      body: data.body,
      mediaUrl: data.media_url,
      mediaKind: (data.media_kind as Post['mediaKind']) ?? 'none',
      statsLine: data.stats_line ?? undefined,
      createdAt: data.created_at
    };
  },

  async createPost(input: CreatePostInput): Promise<Post> {
    if (!env.isSupabaseConfigured) {
      return {
        id: `local-${Date.now()}`,
        author: currentUser,
        kind: input.kind ?? 'post',
        sport: input.sport as Post['sport'],
        body: input.body,
        mediaUrl: input.mediaUrl,
        mediaKind: input.mediaKind ?? (input.mediaUrl ? 'image' : 'none'),
        likedByMe: false,
        likes: 0,
        comments: 0,
        shares: 0,
        createdAt: new Date().toISOString()
      };
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to post.');

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: authData.user.id,
        kind: input.kind ?? 'post',
        sport: input.sport,
        body: input.body,
        media_url: input.mediaUrl ?? null,
        media_kind: input.mediaKind ?? (input.mediaUrl ? 'image' : 'none'),
        visibility: input.visibility ?? 'public'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      author: currentUser,
      kind: (data.kind as Post['kind']) ?? 'post',
      sport: (data.sport as Post['sport']) ?? 'Basketball',
      body: data.body,
      mediaUrl: data.media_url,
      mediaKind: (data.media_kind as Post['mediaKind']) ?? 'none',
      statsLine: data.stats_line ?? undefined,
      likedByMe: false,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: data.created_at
    };
  },

  async listComments(postId: string): Promise<Comment[]> {
    if (!env.isSupabaseConfigured) return comments.filter((comment) => comment.postId === postId);

    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles:author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error || !data) return comments.filter((comment) => comment.postId === postId);

    return data.map((row: any) => ({
      id: row.id,
      postId: row.post_id,
      author: {
        ...currentUser,
        id: row.profiles?.id ?? row.author_id,
        displayName: row.profiles?.display_name ?? 'Athlete',
        username: row.profiles?.username ?? 'athlete',
        initials: (row.profiles?.display_name ?? 'AT').slice(0, 2).toUpperCase()
      },
      body: row.body,
      likes: 0,
      createdAt: row.created_at
    }));
  },

  async createComment(postId: string, body: string): Promise<Comment> {
    if (!env.isSupabaseConfigured) {
      const newComment: Comment = {
        id: `local-comment-${Date.now()}`,
        postId,
        author: currentUser,
        body,
        likes: 0,
        createdAt: new Date().toISOString()
      };
      comments.push(newComment);

      const postIdx = posts.findIndex((p) => p.id === postId);
      if (postIdx > -1) {
        posts[postIdx].comments += 1;
      }
      return newComment;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to comment.');

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: authData.user.id,
        body: body
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      postId: data.post_id,
      author: {
        ...currentUser,
        id: data.profiles?.id ?? data.author_id,
        displayName: data.profiles?.display_name ?? 'Athlete',
        username: data.profiles?.username ?? 'athlete',
        initials: (data.profiles?.display_name ?? 'AT').slice(0, 2).toUpperCase()
      },
      body: data.body,
      likes: 0,
      createdAt: data.created_at
    };
  },

  async togglePostLike(postId: string, liked: boolean): Promise<void> {
    if (!env.isSupabaseConfigured) return;

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
    if (error) throw error;
  }
};
