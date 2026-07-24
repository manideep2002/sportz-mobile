import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { feedDedupeService } from '@/services/feedDedupeService';
import { hotCacheService } from '@/services/hotCacheService';
import { mapProfileRow } from '@/services/profileMapper';
import { storageService } from '@/services/storageService';
import type { Comment, Post, UserProfile } from '@/types/domain';
import { createUuid } from '@/utils/uuid';
import type * as ImagePicker from 'expo-image-picker';

export interface CreatePostInput {
  body: string;
  sport: string;
  kind?: Post['kind'];
  mediaUrl?: string | null;
  mediaAsset?: ImagePicker.ImagePickerAsset | null;
  mediaKind?: Post['mediaKind'];
  statsLine?: string;
  visibility?: 'public' | 'followers' | 'group';
  communityId?: string;
  mentionedUserIds?: string[];
  locationLabel?: string | null;
}

export type UpdatePostInput = Pick<CreatePostInput, 'body' | 'sport'> & Partial<Pick<CreatePostInput, 'kind' | 'statsLine'>> & {
  visibility?: 'public' | 'followers' | 'group';
  communityId?: string | null;
  mediaAsset?: ImagePicker.ImagePickerAsset | null;
  mediaKind?: Post['mediaKind'];
  removeMedia?: boolean;
  mentionedUserIds?: string[];
  locationLabel?: string | null;
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
  community_id: string | null;
  kind: Post['kind'] | null;
  sport: string | null;
  body: string;
  media_url: string | null;
  media_kind: Post['mediaKind'] | null;
  media_placeholder?: string | null;
  media_storage_path?: string | null;
  media_width?: number | null;
  media_height?: number | null;
  media_processing_status?: 'processing' | 'ready' | 'failed' | null;
  stats_line: string | null;
  visibility: Post['visibility'] | null;
  location_label?: string | null;
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

interface PostMentionRow {
  mentioned_user_id: string;
  profiles: EmbeddedProfile | null;
}

type HomeFeedRow = Omit<PostRow, 'profiles'> & {
  profiles?: null;
};

type HomeFeedContextRow = Pick<
  PostRow,
  'id' | 'community_id' | 'location_label' | 'media_storage_path' | 'media_processing_status'
>;

const POST_CACHE_TTL_MS = 1000 * 45;
const ACTIVE_TIMELINE_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
const profileCacheKey = (profileId: string) => `profile:v1:${profileId}`;
const postCachePrefix = (postId: string) => `post:v1:${postId}:`;
const postCacheKey = (postId: string, viewerId: string) => `${postCachePrefix(postId)}${viewerId}`;

/** Shape of a row returned from the `comments` table with joined profile. */
interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
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

/** Shape of a row returned from `post_likes`. */
interface PostLikeRow {
  post_id: string;
}

/** Shape of a row returned from `saved_posts` when scoped to the current user. */
interface SavedPostRow {
  post_id: string;
}

interface PostShareRow {
  post_id: string;
}

const mapPostRow = (
  row: PostRow,
  engagement: PostEngagement,
  mentionedUsers: UserProfile[] = []
): Post => ({
  id: row.id,
  author: mapProfileRow(row.profiles ?? {
    id: row.author_id,
    display_name: row.display_name ?? null,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null
  }),
  communityId: row.community_id,
  kind: row.kind ?? 'post',
  sport: row.sport ?? 'Basketball',
  body: row.body,
  mediaUrl: row.media_url,
  mediaKind: row.media_kind ?? 'none',
  mediaPlaceholder: row.media_placeholder ?? null,
  mediaStoragePath: row.media_storage_path ?? null,
  mediaWidth: row.media_width ?? null,
  mediaHeight: row.media_height ?? null,
  statsLine: row.stats_line ?? undefined,
  visibility: row.visibility ?? 'public',
  locationLabel: row.location_label ?? null,
  mentionedUserIds: mentionedUsers.map((profile) => profile.id),
  mentionedUsers,
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

const getViewerCacheId = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? 'anon';
};

const loadPostEngagement = async (postIds: string[]): Promise<PostEngagement> => {
  const engagement = emptyEngagement();
  if (!postIds.length) return engagement;

  // Single auth call plus parallel queries scoped to the known post IDs.
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id;

  const [likesResult, sharesResult, savesResult] = await Promise.all([
    currentUserId
      ? supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', currentUserId)
          .in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
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
  if (sharesResult.error && sharesResult.error.code !== '42P01') throw sharesResult.error;
  // Gracefully ignore "relation does not exist" (42P01) on saved_posts so the
  // feed still loads before the migration has been applied to Supabase.
  if (savesResult.error && savesResult.error.code !== '42P01') throw savesResult.error;

  for (const like of (likesResult.data ?? []) as PostLikeRow[]) {
    engagement.likedByMe.add(like.post_id);
  }
  for (const share of (sharesResult.data ?? []) as PostShareRow[]) {
    engagement.shares.set(share.post_id, (engagement.shares.get(share.post_id) ?? 0) + 1);
  }
  for (const save of (savesResult.data ?? []) as SavedPostRow[]) {
    engagement.savedByMe.add(save.post_id);
  }

  return engagement;
};

const loadPostMentions = async (postId: string): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('post_mentions')
    .select('mentioned_user_id, profiles:mentioned_user_id(*)')
    .eq('post_id', postId);
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return ((data ?? []) as unknown as PostMentionRow[]).map((row) =>
    mapProfileRow(row.profiles ?? { id: row.mentioned_user_id })
  );
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
  // Query functions must be deterministic. Deduplicate only within this
  // response; a process-wide "seen" set can empty a concurrent refetch.
  const uniqueRows = feedDedupeService.keepUnique(rows, (row) => row.id);
  const engagement = await loadPostEngagement(uniqueRows.map((row) => row.id));
  const items = uniqueRows.map((row) => mapPostRow(row, engagement));

  return {
    items,
    nextCursor: rows.length ? rows[rows.length - 1].created_at : undefined
  };
};

const listCachedHomeFeedPage = async (cursor?: string, limit = 10): Promise<FeedPage | null> => {
  // v2 has the same discovery backfill as the direct query. Calling the
  // versioned RPC means clients safely fall back while its migration deploys
  // instead of switching to the older, smaller followed-only result set.
  const { data, error } = await supabase.rpc('list_home_feed_v2', {
    page_cursor: cursor ?? null,
    page_limit: limit
  });

  if (error) {
    if (isHomeFeedCacheUnavailableError(error)) return null;
    throw error;
  }

  const cachedRows = (data ?? []) as HomeFeedRow[];
  const { data: contextData, error: contextError } = cachedRows.length
    ? await supabase
        .from('posts')
        .select('id, community_id, location_label, media_storage_path, media_processing_status')
        .in('id', cachedRows.map((row) => row.id))
    : { data: [], error: null };
  if (contextError) throw contextError;
  const contextByPostId = new Map(
    ((contextData ?? []) as HomeFeedContextRow[]).map((row) => [row.id, row])
  );
  const rows = cachedRows.map((row) => ({
    ...row,
    ...contextByPostId.get(row.id),
    profiles: null
  })) as PostRow[];

  const page = await mapFeedRows(rows);
  return {
    ...page,
    nextCursor: rows.length === limit ? page.nextCursor : undefined
  };
};

const listDirectFeedPage = async (cursor?: string, limit = 10): Promise<FeedPage> => {
  const activeCutoff = new Date(Date.now() - ACTIVE_TIMELINE_RETENTION_MS).toISOString();
  let request = supabase
    .from('posts')
    .select('*, profiles:author_id(*)')
    .gte('created_at', activeCutoff)
    // Group/community posts must never appear in the global home feed —
    // they are only visible inside their community screen.
    .neq('visibility', 'group')
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

const loadPost = async (postId: string): Promise<Post> => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles:author_id(*)')
    .eq('id', postId)
    .single();
  if (error) throw error;

  const [engagement, mentionedUsers] = await Promise.all([
    loadPostEngagement([data.id]),
    loadPostMentions(data.id)
  ]);
  return mapPostRow(data as unknown as PostRow, engagement, mentionedUsers);
};

const invalidatePostCache = (postId: string) => hotCacheService.invalidateByPrefix(postCachePrefix(postId));

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
    const page = await this.listCommunityPostsPage(communityId, undefined, 20);
    return page.items;
  },

  async listCommunityPostsPage(communityId: string, cursor?: string, limit = 10): Promise<FeedPage> {
    assertSupabaseConfigured();

    let request = supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      request = request.lt('created_at', cursor);
    }

    const { data, error } = await request;

    if (error) throw error;

    const rows = (data ?? []) as PostRow[];
    const pageRows = rows.slice(0, limit);
    const engagement = await loadPostEngagement(pageRows.map((row) => row.id));
    const items = pageRows.map((row) => mapPostRow(row, engagement));

    return {
      items,
      nextCursor: rows.length > limit && pageRows.length
        ? pageRows[pageRows.length - 1].created_at
        : undefined
    };
  },

  async listFeedPage(cursor?: string, limit = 10): Promise<FeedPage> {
    assertSupabaseConfigured();

    const cachedPage = await listCachedHomeFeedPage(cursor, limit);
    if (cachedPage && (cursor || cachedPage.items.length > 0)) {
      return cachedPage;
    }

    return listDirectFeedPage(cursor, limit);
  },

  async getPost(postId: string): Promise<Post> {
    assertSupabaseConfigured();

    const viewerId = await getViewerCacheId();
    return hotCacheService.getOrSet(postCacheKey(postId, viewerId), () => loadPost(postId), {
      ttlMs: POST_CACHE_TTL_MS
    });
  },

  async getPostForEdit(postId: string): Promise<Post> {
    assertSupabaseConfigured();
    return loadPost(postId);
  },

  async createPost(input: CreatePostInput): Promise<Post> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to post.');

    const postId = input.mediaAsset ? createUuid() : undefined;
    const mediaUpload = input.mediaAsset
      ? await storageService.uploadPostMediaResumable(input.mediaAsset, authData.user.id, postId as string)
      : null;
    const fallbackMediaUrl = !mediaUpload && input.mediaUrl
      ? await storageService.uploadMedia(input.mediaUrl, 'post-media', authData.user.id)
      : null;
    const mediaUrl = mediaUpload?.publicUrl ?? fallbackMediaUrl;
    const mediaStoragePath = mediaUpload?.objectName ?? null;
    const mediaWidth = input.mediaAsset?.width ?? null;
    const mediaHeight = input.mediaAsset?.height ?? null;

    const { data, error } = await supabase
      .from('posts')
      .insert({
        ...(postId ? { id: postId } : {}),
        author_id: authData.user.id,
        kind: input.kind ?? 'post',
        sport: input.sport,
        body: input.body,
        media_url: mediaUrl,
        media_kind: input.mediaKind ?? (mediaUrl ? 'image' : 'none'),
        media_storage_path: mediaStoragePath,
        media_width: mediaWidth,
        media_height: mediaHeight,
        media_processing_status: mediaUpload ? 'processing' : 'ready',
        stats_line: input.statsLine ?? null,
        visibility: input.communityId
          ? (input.visibility ?? 'group')
          : (input.visibility ?? 'public'),
        community_id: input.communityId ?? null,
        location_label: input.locationLabel?.trim() || null
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) {
      if (mediaUpload?.objectName) {
        await storageService.removePostMedia(mediaUpload.objectName).catch(() => undefined);
      }
      throw error;
    }
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

    const mentionedUsers = mentionedUserIds.length ? await loadPostMentions(data.id) : [];
    const post = mapPostRow(data as unknown as PostRow, emptyEngagement(), mentionedUsers);
    await hotCacheService.set(postCacheKey(post.id, authData.user.id), post, { ttlMs: POST_CACHE_TTL_MS });
    await hotCacheService.invalidate(profileCacheKey(authData.user.id));
    return post;
  },

  async updatePost(postId: string, input: UpdatePostInput): Promise<Post> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to edit posts.');

    const { data: originalData, error: originalError } = await supabase
      .from('posts')
      .select('*, profiles:author_id(*)')
      .eq('id', postId)
      .eq('author_id', authData.user.id)
      .single();
    if (originalError) throw originalError;

    const originalRow = originalData as unknown as PostRow;
    const originalMediaStoragePath = originalRow.media_storage_path ??
      storageService.postMediaObjectNameFromUrl(originalRow.media_url);
    if (
      input.communityId !== undefined &&
      input.communityId !== originalRow.community_id
    ) {
      throw new Error('A post cannot be moved into or out of a community.');
    }

    const visibility = input.visibility ?? originalRow.visibility ?? 'public';
    if (originalRow.community_id && originalRow.visibility === 'group' && visibility !== 'group') {
      throw new Error('A group post must remain visible only to its community.');
    }

    const [engagement, originalMentionedUsers] = await Promise.all([
      loadPostEngagement([postId]),
      loadPostMentions(postId)
    ]);
    const mentionedUserIds = Array.from(new Set(
      input.mentionedUserIds ?? originalMentionedUsers.map((profile) => profile.id)
    )).filter((userId) => userId && userId !== authData.user?.id);

    let replacementUpload: Awaited<ReturnType<typeof storageService.uploadPostMediaResumable>> | null = null;
    if (input.mediaAsset) {
      storageService.validateMediaAsset(input.mediaAsset);
      replacementUpload = await storageService.uploadPostMediaResumable(
        input.mediaAsset,
        authData.user.id
      );
    }

    const mediaRemoved = input.removeMedia === true;
    const mediaUrl = mediaRemoved
      ? null
      : replacementUpload?.publicUrl ?? originalRow.media_url;
    const mediaStoragePath = mediaRemoved
      ? null
      : replacementUpload?.objectName ?? originalRow.media_storage_path ?? null;
    const mediaKind = mediaRemoved
      ? 'none'
      : input.mediaAsset
        ? (input.mediaKind ?? (input.mediaAsset.type === 'video' ? 'video' : 'image'))
        : originalRow.media_kind ?? 'none';
    const mediaWidth = mediaRemoved
      ? null
      : input.mediaAsset?.width ?? originalRow.media_width ?? null;
    const mediaHeight = mediaRemoved
      ? null
      : input.mediaAsset?.height ?? originalRow.media_height ?? null;

    const { data, error } = await supabase.rpc('update_post_content', {
      target_post_id: postId,
      target_body: input.body,
      target_sport: input.sport,
      target_kind: input.kind ?? originalRow.kind ?? 'post',
      target_stats_line: input.statsLine ?? originalRow.stats_line,
      target_visibility: visibility,
      target_media_url: mediaUrl,
      target_media_kind: mediaKind,
      target_media_storage_path: mediaStoragePath,
      target_media_width: mediaWidth,
      target_media_height: mediaHeight,
      target_media_processing_status: replacementUpload
        ? 'processing'
        : originalRow.media_processing_status ?? 'ready',
      target_location_label: input.locationLabel ?? originalRow.location_label ?? null,
      target_mentioned_user_ids: mentionedUserIds
    });
    if (error) {
      if (replacementUpload?.objectName) {
        await storageService.removePostMedia(replacementUpload.objectName).catch(() => undefined);
      }
      throw error;
    }

    const updatedRow = {
      ...(data as unknown as PostRow),
      profiles: originalRow.profiles
    };

    if (input.kind === 'stats' || input.statsLine !== undefined) {
      await updateProfileStatsFromPosts(authData.user.id).catch(() => undefined);
    }

    const { data: mentionedData, error: mentionedError } = await supabase
      .from('post_mentions')
      .select('mentioned_user_id, profiles:mentioned_user_id(*)')
      .eq('post_id', postId);
    const mentionedUsers = mentionedError
      ? originalMentionedUsers.filter((profile) => mentionedUserIds.includes(profile.id))
      : ((mentionedData ?? []) as unknown as PostMentionRow[]).map((row) =>
          mapProfileRow(row.profiles ?? { id: row.mentioned_user_id })
        );
    const post = mapPostRow(updatedRow, engagement, mentionedUsers);
    await invalidatePostCache(postId);
    await hotCacheService.set(postCacheKey(postId, authData.user.id), post, { ttlMs: POST_CACHE_TTL_MS });
    await hotCacheService.invalidate(profileCacheKey(authData.user.id));

    const replacedExistingMedia = replacementUpload || mediaRemoved;
    if (
      replacedExistingMedia &&
      originalMediaStoragePath &&
      originalMediaStoragePath !== mediaStoragePath
    ) {
      await storageService.removePostMedia(originalMediaStoragePath).catch(() => undefined);
    }

    return post;
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
      .from('post_comments')
      .select('*, profiles:author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const engagement = await loadCommentEngagement((data ?? []).map((row: CommentRow) => row.id));

    return (data ?? []).map((row: CommentRow) => ({
      id: row.id,
      postId: row.post_id,
      parentCommentId: row.parent_id,
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
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: authData.user.id,
        parent_id: parentCommentId ?? null,
        body
      })
      .select('*, profiles:author_id(*)')
      .single();

    if (error) throw error;

    const comment = {
      id: data.id,
      postId: (data as unknown as CommentRow).post_id,
      parentCommentId: (data as unknown as CommentRow).parent_id,
      author: mapProfileRow((data as unknown as CommentRow).profiles ?? { id: (data as unknown as CommentRow).author_id }),
      body: data.body,
      likes: 0,
      createdAt: data.created_at
    };

    await invalidatePostCache(postId);
    return comment;
  },

  async togglePostLike(postId: string, liked: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to like posts.');

    if (liked) {
      const { error } = await supabase.from('post_likes').delete().match({
        user_id: authData.user.id,
        post_id: postId
      });
      if (error) throw error;
      await invalidatePostCache(postId);
      return;
    }

    const { error } = await supabase.from('post_likes').insert({
      user_id: authData.user.id,
      post_id: postId
    });
    if (error && error.code !== '23505') throw error;
    await invalidatePostCache(postId);
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
      await invalidatePostCache(postId);
      return;
    }

    const { error } = await supabase.from('saved_posts').insert({
      user_id: authData.user.id,
      post_id: postId
    });
    // Ignore duplicate (23505) and missing table (42P01)
    if (error && error.code !== '23505' && error.code !== '42P01') throw error;
    await invalidatePostCache(postId);
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
    await invalidatePostCache(postId);
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

    const { data: comment, error: fetchError } = await supabase
      .from('post_comments')
      .select('post_id')
      .eq('id', commentId)
      .eq('author_id', authData.user.id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', authData.user.id);
    if (error) throw error;
    if (comment?.post_id) await invalidatePostCache(comment.post_id as string);
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
    await invalidatePostCache(postId);
    await hotCacheService.invalidate(profileCacheKey(authData.user.id));
  }
};
