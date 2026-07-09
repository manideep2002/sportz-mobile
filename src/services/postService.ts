import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { feedDedupeService } from '@/services/feedDedupeService';
import { mapProfileRow } from '@/services/profileMapper';
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
  communityId?: string;
  mentionedUserIds?: string[];
}

export type UpdatePostInput = Partial<Pick<CreatePostInput, 'body' | 'sport' | 'kind' | 'statsLine'>> & {
  visibility?: 'public' | 'followers';
};

export interface FeedPage {
  items: Post[];
  nextCursor?: string;
}

interface PostEngagement {
  likes: Map<string, number>;
  comments: Map<string, number>;
  shares: Map<string, number>;
  likedByMe: Set<string>;
  savedByMe: Set<string>;
}

/** Minimal profile shape embedded in a post/comment row. */
interface EmbeddedProfile {
  id: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  primary_sport?: string | null;
  sports?: string[] | null;
  position?: string | null;
  skill_level?: string | null;
  is_verified?: boolean | null;
  is_hireable?: boolean | null;
}

/** Shape of a row returned from the `posts` table with joined profile. */
interface PostRow {
  id: string;
  author_id: string;
  kind: Post['kind'] | null;
  sport: string | null;
  body: string;
  media_url: string | null;
  media_kind: Post['mediaKind'] | null;
  stats_line: string | null;
  visibility: Post['visibility'] | null;
  created_at: string;
  /** Supabase returns the joined relation as `profiles` when using `profiles:author_id(*)`. */
  profiles: EmbeddedProfile | null;
  /** Fallback flat columns from the `feed_posts` view. */
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  likes_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
}

type HomeFeedRow = Omit<PostRow, 'profiles'> & {
  profiles?: null;
};

/** Shape of a row returned from the `comments` table with joined profile. */
interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  profiles: EmbeddedProfile | null;
}

interface CommentEngagement {
  likes: Map<string, number>;
  likedByMe: Set<string>;
}

/** Shape of a row returned from `likes`. */
interface LikeRow {
  entity_id: string;
  user_id: string;
}

/** Shape of a row returned from `comments` when only `post_id` is selected. */
interface CommentCountRow {
  post_id: string;
}

/** Shape of a row returned from `saved_posts` when scoped to the current user. */
interface SavedPostRow {
  post_id: string;
}

interface PostShareRow {
  post_id: string;
}

const mapPostRow = (row: PostRow, engagement: PostEngagement): Post => ({
  id: row.id,
  author: mapProfileRow(row.profiles ?? {
    id: row.author_id,
    display_name: row.display_name ?? null,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null
  }),
  kind: row.kind ?? 'post',
  sport: row.sport ?? 'Basketball',
  body: row.body,
  mediaUrl: row.media_url,
  mediaKind: row.media_kind ?? 'none',
  statsLine: row.stats_line ?? undefined,
  visibility: row.visibility ?? 'public',
  likedByMe: engagement.likedByMe.has(row.id),
  savedByMe: engagement.savedByMe.has(row.id),
  likes: engagement.likes.get(row.id) ?? row.likes_count ?? 0,
  comments: engagement.comments.get(row.id) ?? row.comments_count ?? 0,
  shares: engagement.shares.get(row.id) ?? row.shares_count ?? 0,
  createdAt: row.created_at
});

const emptyEngagement = (): PostEngagement => ({
  likes: new Map(),
  comments: new Map(),
  shares: new Map(),
  likedByMe: new Set(),
  savedByMe: new Set()
});

const loadPostEngagement = async (postIds: string[]): Promise<PostEngagement> => {
  const engagement = emptyEngagement();
  if (!postIds.length) return engagement;

  // Single auth call plus parallel queries scoped to the known post IDs.
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id;

  const [likesResult, commentsResult, sharesResult, savesResult] = await Promise.all([
    supabase
      .from('likes')
      .select('entity_id, user_id')
      .eq('entity_type', 'post')
      .in('entity_id', postIds),
    supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds),
    supabase
      .from('post_shares')
      .select('post_id')
      .in('post_id', postIds),
    // Only fetch saves for the current user — no need to load everyone's saves
    currentUserId
      ? supabase
          .from('saved_posts')
          .select('post_id')
          .eq('user_id', currentUserId)
          .in('post_id', postIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (likesResult.error) throw likesResult.error;
  if (commentsResult.error) throw commentsResult.error;
  if (sharesResult.error && sharesResult.error.code !== '42P01') throw sharesResult.error;
  // Gracefully ignore "relation does not exist" (42P01) on saved_posts so the
  // feed still loads before the migration has been applied to Supabase.
  if (savesResult.error && savesResult.error.code !== '42P01') throw savesResult.error;

  for (const like of (likesResult.data ?? []) as LikeRow[]) {
    engagement.likes.set(like.entity_id, (engagement.likes.get(like.entity_id) ?? 0) + 1);
    if (currentUserId === like.user_id) engagement.likedByMe.add(like.entity_id);
  }
  for (const comment of (commentsResult.data ?? []) as CommentCountRow[]) {
    engagement.comments.set(comment.post_id, (engagement.comments.get(comment.post_id) ?? 0) + 1);
  }
  for (const share of (sharesResult.data ?? []) as PostShareRow[]) {
    engagement.shares.set(share.post_id, (engagement.shares.get(share.post_id) ?? 0) + 1);
  }
  for (const save of (savesResult.data ?? []) as SavedPostRow[]) {
    engagement.savedByMe.add(save.post_id);
  }

  return engagement;
};

const loadCommentEngagement = async (commentIds: string[]): Promise<CommentEngagement> => {
  const engagement: CommentEngagement = { likes: new Map(), likedByMe: new Set() };
  if (!commentIds.length) return engagement;

  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id;
  const { data, error } = await supabase
    .from('likes')
    .select('entity_id, user_id')
    .eq('entity_type', 'comment')
    .in('entity_id', commentIds);
  if (error) throw error;

  for (const like of (data ?? []) as LikeRow[]) {
    engagement.likes.set(like.entity_id, (engagement.likes.get(like.entity_id) ?? 0) + 1);
    if (like.user_id === currentUserId) engagement.likedByMe.add(like.entity_id);
  }

  return engagement;
};

const parseStatsLine = (statsLine?: string) => {
  if (!statsLine) return { points: 0, rebounds: 0, result: undefined as 'win' | 'loss' | undefined };
  const normalized = statsLine.toUpperCase();
  const points = Number(statsLine.match(/(\d+)\s*PTS?/i)?.[1] ?? 0);
  const rebounds = Number(statsLine.match(/(\d+)\s*REB/i)?.[1] ?? 0);
  const isLoss = /\b(L|LOSS)\b/.test(normalized);
  const isWin = !isLoss && /\b(W|WIN)\b/.test(normalized);
  return { points, rebounds, result: isWin ? 'win' as const : isLoss ? 'loss' as const : undefined };
};

const updateProfileStatsFromPosts = async (userId: string) => {
  const { data, error } = await supabase
    .from('posts')
    .select('stats_line')
    .eq('author_id', userId)
    .eq('kind', 'stats');
  if (error) throw error;

  const parsed = (data ?? []).map((row: { stats_line: string | null }) => parseStatsLine(row.stats_line ?? undefined));
  const gamesPlayed = parsed.length;
  const bestPoints = parsed.reduce((best, item) => Math.max(best, item.points), 0);
  const totalRebounds = parsed.reduce((sum, item) => sum + item.rebounds, 0);
  const avgRebounds = gamesPlayed ? Number((totalRebounds / gamesPlayed).toFixed(2)) : 0;
  const decidedGames = parsed.filter((item) => item.result);
  const wins = decidedGames.filter((item) => item.result === 'win').length;
  const winRate = decidedGames.length ? Number(((wins / decidedGames.length) * 100).toFixed(2)) : 0;

  await supabase
    .from('profiles')
    .update({
      games_played: gamesPlayed,
      win_rate: winRate,
      best_points: bestPoints || null,
      avg_rebounds: avgRebounds,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
};

const isHomeFeedCacheUnavailableError = (error: { code?: string } | null) =>
  error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883';

const mapFeedRows = async (rows: PostRow[]): Promise<FeedPage> => {
  const uniqueRows = feedDedupeService.keepUnseen(rows, (row) => row.id);
  const engagement = await loadPostEngagement(uniqueRows.map((row) => row.id));
  const items = uniqueRows.map((row) => mapPostRow(row, engagement));

  return {
    items,
    nextCursor: rows.length ? rows[rows.length - 1].created_at : undefined
  };
};

const listCachedHomeFeedPage = async (cursor?: string, limit = 10): Promise<FeedPage | null> => {
  const { data, error } = await supabase.rpc('list_home_feed', {
    page_cursor: cursor ?? null,
    page_limit: limit
  });

  if (error) {
    if (isHomeFeedCacheUnavailableError(error)) return null;
    throw error;
  }

  const rows = ((data ?? []) as HomeFeedRow[]).map((row) => ({
    ...row,
    profiles: null
  })) as PostRow[];

  const page = await mapFeedRows(rows);
  return {
    ...page,
    nextCursor: rows.length === limit ? page.nextCursor : undefined
  };
};

const listDirectFeedPage = async (cursor?: string, limit = 10): Promise<FeedPage> => {
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

  const rows = (data ?? []) as PostRow[];
  const page = await mapFeedRows(rows);
  return {
    ...page,
    nextCursor: rows.length === limit ? page.nextCursor : undefined
  };
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

    const engagement = await loadPostEngagement((data ?? []).map((row: PostRow) => row.id));
    return (data ?? []).map((row: PostRow) => mapPostRow(row, engagement));
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

    const engagement = await loadPostEngagement((data ?? []).map((row: PostRow) => row.id));
    return (data ?? []).map((row: PostRow) => mapPostRow(row, engagement));
  },

  async listFeedPage(cursor?: string, limit = 10): Promise<FeedPage> {
    assertSupabaseConfigured();

    if (!cursor) {
      feedDedupeService.reset();
    }

    const cachedPage = await listCachedHomeFeedPage(cursor, limit);
    if (cachedPage && (cursor || cachedPage.items.length > 0)) {
      return cachedPage;
    }

    return listDirectFeedPage(cursor, limit);
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
    return mapPostRow(data as unknown as PostRow, engagement);
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
        visibility: input.visibility ?? 'public',
        community_id: input.communityId ?? null
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) throw error;
    if ((input.kind ?? 'post') === 'stats') {
      await updateProfileStatsFromPosts(authData.user.id);
    }

    const mentionedUserIds = Array.from(new Set(input.mentionedUserIds ?? [])).filter(
      (userId) => userId && userId !== authData.user?.id
    );
    if (mentionedUserIds.length) {
      const { error: mentionError } = await supabase.from('post_mentions').upsert(
        mentionedUserIds.map((mentionedUserId) => ({
          post_id: data.id,
          mentioned_user_id: mentionedUserId
        })),
        { onConflict: 'post_id,mentioned_user_id' }
      );
      if (mentionError && mentionError.code !== '42P01') throw mentionError;
    }

    return mapPostRow(data as unknown as PostRow, emptyEngagement());
  },

  async updatePost(postId: string, input: UpdatePostInput): Promise<Post> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to edit posts.');

    const updateData: Partial<{
      body: string;
      sport: string;
      kind: Post['kind'];
      stats_line: string | null;
      visibility: 'public' | 'followers';
      updated_at: string;
    }> = {
      updated_at: new Date().toISOString()
    };
    if (input.body !== undefined) updateData.body = input.body;
    if (input.sport !== undefined) updateData.sport = input.sport;
    if (input.kind !== undefined) updateData.kind = input.kind;
    if (input.statsLine !== undefined) updateData.stats_line = input.statsLine ?? null;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;

    const { data, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', postId)
      .eq('author_id', authData.user.id)
      .select('*, profiles:author_id(*)')
      .single();
    if (error) throw error;

    if (input.kind === 'stats' || input.statsLine !== undefined) {
      await updateProfileStatsFromPosts(authData.user.id);
    }

    const engagement = await loadPostEngagement([postId]);
    return mapPostRow(data as unknown as PostRow, engagement);
  },

  async listSavedPosts(): Promise<Post[]> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    const { data, error } = await supabase
      .from('saved_posts')
      .select('post_id, created_at, posts:post_id(*, profiles:author_id(*))')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? [])
      .map((row) => (row as unknown as { posts: PostRow | null }).posts)
      .filter((row): row is PostRow => Boolean(row));
    const engagement = await loadPostEngagement(rows.map((row) => row.id));
    return rows.map((row) => mapPostRow(row, engagement));
  },

  async listComments(postId: string): Promise<Comment[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles:author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const engagement = await loadCommentEngagement((data ?? []).map((row: CommentRow) => row.id));

    return (data ?? []).map((row: CommentRow) => ({
      id: row.id,
      postId: row.post_id,
      parentCommentId: row.parent_comment_id,
      author: mapProfileRow(row.profiles ?? { id: row.author_id }),
      body: row.body,
      likes: engagement.likes.get(row.id) ?? 0,
      likedByMe: engagement.likedByMe.has(row.id),
      createdAt: row.created_at
    } as Comment));
  },

  async createComment(postId: string, body: string, parentCommentId?: string | null): Promise<Comment> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to comment.');

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: authData.user.id,
        parent_comment_id: parentCommentId ?? null,
        body
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      postId: (data as unknown as CommentRow).post_id,
      parentCommentId: (data as unknown as CommentRow).parent_comment_id,
      author: mapProfileRow((data as unknown as CommentRow).profiles ?? { id: (data as unknown as CommentRow).author_id }),
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
      // Ignore "relation does not exist" — migration not yet applied
      if (error && error.code !== '42P01') throw error;
      return;
    }

    const { error } = await supabase.from('saved_posts').insert({
      user_id: authData.user.id,
      post_id: postId
    });
    // Ignore duplicate (23505) and missing table (42P01)
    if (error && error.code !== '23505' && error.code !== '42P01') throw error;
  },

  async recordPostShare(postId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to share posts.');

    const { error } = await supabase.from('post_shares').insert({
      post_id: postId,
      user_id: authData.user.id
    });
    if (error && error.code !== '23505' && error.code !== '42P01') throw error;
  },

  async toggleCommentLike(commentId: string, liked: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to like comments.');

    if (liked) {
      const { error } = await supabase.from('likes').delete().match({
        user_id: authData.user.id,
        entity_type: 'comment',
        entity_id: commentId
      });
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('likes').insert({
      user_id: authData.user.id,
      entity_type: 'comment',
      entity_id: commentId
    });
    if (error && error.code !== '23505') throw error;
  },

  async deleteComment(commentId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to delete comments.');

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', authData.user.id);
    if (error) throw error;
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
