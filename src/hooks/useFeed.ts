import { useEffect } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey
} from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { feedDedupeService } from '@/services/feedDedupeService';
import { mapProfileRow } from '@/services/profileMapper';
import { postService, type CreatePostInput, type FeedPage, type UpdatePostInput } from '@/services/postService';
import { useAuthStore } from '@/store/authStore';
import type { Comment, Post } from '@/types/domain';

const infiniteFeedRoot = ['feed', 'infinite', 'v2'] as const;

export const feedKeys = {
  infiniteRoot: infiniteFeedRoot,
  infinite: (viewerId: string) => [...infiniteFeedRoot, viewerId] as const,
  post: (id: string) => ['post', id] as const,
  editablePost: (id: string) => ['post', 'edit', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  userPosts: (userId: string) => ['feed', 'user', userId] as const,
  communityPosts: (communityId: string) => ['feed', 'community', communityId] as const,
  savedPosts: ['feed', 'saved'] as const
};

export const useInfiniteFeed = () => {
  const viewerId = useAuthStore((state) => state.user?.id ?? 'anonymous');

  return useInfiniteQuery({
    queryKey: feedKeys.infinite(viewerId),
    queryFn: ({ pageParam }) => postService.listFeedPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
};

export const useUserPosts = (userId: string) =>
  useQuery({
    queryKey: feedKeys.userPosts(userId),
    queryFn: () => postService.listUserPosts(userId)
  });

export const useCommunityPosts = (communityId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: feedKeys.communityPosts(communityId),
    queryFn: ({ pageParam }) =>
      postService.listCommunityPostsPage(communityId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(communityId) && enabled
  });

export const flattenCommunityPostPages = (data?: { pages: FeedPage[] }) =>
  feedDedupeService.keepUnique(
    data?.pages.flatMap((page) => page.items) ?? [],
    (post) => post.id
  );

export const useSavedPosts = () =>
  useQuery({
    queryKey: feedKeys.savedPosts,
    queryFn: () => postService.listSavedPosts()
  });

export const usePost = (postId: string) =>
  useQuery({
    queryKey: feedKeys.post(postId),
    queryFn: () => postService.getPost(postId),
    enabled: Boolean(postId)
  });

export const useEditablePost = (postId: string) =>
  useQuery({
    queryKey: feedKeys.editablePost(postId),
    queryFn: () => postService.getPostForEdit(postId),
    enabled: Boolean(postId)
  });

export const useComments = (postId: string) =>
  useQuery({
    queryKey: feedKeys.comments(postId),
    queryFn: () => postService.listComments(postId)
  });

const prependUniquePost = (posts: Post[], post: Post) => [
  post,
  ...posts.filter((item) => item.id !== post.id)
];

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => postService.createPost(input),
    onSuccess: (post, input) => {
      if (!input.communityId && post.visibility !== 'group') {
        queryClient.setQueryData<InfiniteFeedData>(feedKeys.infinite(post.author.id), (old) => {
          if (!old?.pages.length) return old;

          const [firstPage, ...remainingPages] = old.pages;
          return {
            ...old,
            pages: [
              { ...firstPage, items: prependUniquePost(firstPage.items, post) },
              ...remainingPages
            ]
          };
        });
      }

      queryClient.setQueryData<Post[]>(feedKeys.userPosts(post.author.id), (old) =>
        old ? prependUniquePost(old, post) : old
      );
      if (input.communityId) {
        queryClient.setQueryData<InfiniteFeedData>(feedKeys.communityPosts(input.communityId), (old) => {
          if (!old?.pages.length) return old;
          const [firstPage, ...remainingPages] = old.pages;
          return {
            ...old,
            pages: [
              { ...firstPage, items: prependUniquePost(firstPage.items, post) },
              ...remainingPages
            ]
          };
        });
      }

      void queryClient.invalidateQueries({ queryKey: feedKeys.infinite(post.author.id), exact: true });
      void queryClient.invalidateQueries({ queryKey: feedKeys.userPosts(post.author.id), exact: true });
      if (input.communityId) {
        void queryClient.invalidateQueries({ queryKey: feedKeys.communityPosts(input.communityId), exact: true });
      }
    }
  });
};

export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      postService.updatePost(postId, input),
    onSuccess: (post) => {
      patchPostEverywhere(queryClient, post.id, () => post);
      queryClient.setQueryData(feedKeys.editablePost(post.id), post);
    }
  });
};

type InfiniteFeedData = {
  pages: FeedPage[];
  pageParams: unknown[];
};

type CachedQuerySnapshot = [QueryKey, unknown][];

const isPost = (value: unknown): value is Post =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Post).id === 'string' &&
  typeof (value as Post).body === 'string';

const isInfiniteFeedData = (value: unknown): value is InfiniteFeedData =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as InfiniteFeedData).pages) &&
  Array.isArray((value as InfiniteFeedData).pageParams);

const patchPostInQueryData = <T,>(old: T | undefined, postId: string, patch: (post: Post) => Post): T | undefined => {
  if (!old) return old;

  if (isInfiniteFeedData(old)) {
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((post) => (post.id === postId ? patch(post) : post))
      }))
    } as T;
  }

  if (Array.isArray(old) && old.every(isPost)) {
    return old.map((post) => (post.id === postId ? patch(post) : post)) as T;
  }

  if (isPost(old)) {
    return old.id === postId ? (patch(old) as T) : old;
  }

  return old;
};

const removePostFromQueryData = <T,>(old: T | undefined, postId: string): T | undefined => {
  if (!old) return old;

  if (isInfiniteFeedData(old)) {
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.filter((post) => post.id !== postId)
      }))
    } as T;
  }

  if (Array.isArray(old) && old.every(isPost)) {
    return old.filter((post) => post.id !== postId) as T;
  }

  return old;
};

const snapshotFeedQueries = (queryClient: QueryClient): CachedQuerySnapshot =>
  queryClient.getQueriesData<unknown>({ queryKey: ['feed'] });

const restoreQueries = (queryClient: QueryClient, snapshots?: CachedQuerySnapshot) => {
  snapshots?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
};

const patchPostEverywhere = (queryClient: QueryClient, postId: string, patch: (post: Post) => Post) => {
  queryClient.setQueriesData<unknown>({ queryKey: ['feed'] }, (old: unknown) => patchPostInQueryData(old, postId, patch));
  queryClient.setQueryData<Post>(feedKeys.post(postId), (old) => patchPostInQueryData(old, postId, patch));
};

const getCachedPost = (queryClient: QueryClient, postId: string) => {
  const detailPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
  if (detailPost) return detailPost;

  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: ['feed'] })) {
    if (isInfiniteFeedData(data)) {
      const post = data.pages.flatMap((page) => page.items).find((item) => item.id === postId);
      if (post) return post;
    }
    if (Array.isArray(data) && data.every(isPost)) {
      const post = data.find((item) => item.id === postId);
      if (post) return post;
    }
  }

  return undefined;
};

export const useCreateComment = (postId: string) => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) =>
      postService.createComment(postId, body, parentCommentId),
    onMutate: async ({ body, parentCommentId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedKeys.comments(postId) }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) }),
        queryClient.cancelQueries({ queryKey: ['feed'] })
      ]);

      const previousComments = queryClient.getQueryData<Comment[]>(feedKeys.comments(postId));
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const previousFeedQueries = snapshotFeedQueries(queryClient);
      const optimisticId = `optimistic-comment-${Date.now()}`;
      const optimisticComment: Comment = {
        id: optimisticId,
        postId,
        parentCommentId: parentCommentId ?? null,
        author: profile ?? mapProfileRow({ id: '' }),
        body,
        likes: 0,
        likedByMe: false,
        createdAt: new Date().toISOString()
      };

      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (old = []) => [...old, optimisticComment]);
      patchPostEverywhere(queryClient, postId, (post) => ({ ...post, comments: post.comments + 1 }));

      return { previousComments, previousPost, previousFeedQueries, optimisticId };
    },
    onSuccess: (comment, _variables, context) => {
      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (old = []) =>
        old.map((item) => (item.id === context?.optimisticId ? comment : item))
      );
    },
    onError: (_error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(feedKeys.comments(postId), context.previousComments);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(feedKeys.post(postId), context.previousPost);
      }
      restoreQueries(queryClient, context?.previousFeedQueries);
    }
  });
};

export const useRecordPostShare = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postService.recordPostShare(postId),
    onMutate: async (postId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['feed'] }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) })
      ]);
      const previousFeedQueries = snapshotFeedQueries(queryClient);
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const patch = (post: Post): Post => ({ ...post, shares: post.shares + 1 });

      patchPostEverywhere(queryClient, postId, patch);

      return { previousFeedQueries, previousPost, postId };
    },
    onError: (_error, _postId, context) => {
      restoreQueries(queryClient, context?.previousFeedQueries);
      if (context?.previousPost) {
        queryClient.setQueryData(feedKeys.post(context.postId), context.previousPost);
      }
    }
  });
};

export const useOptimisticCommentLike = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      postService.toggleCommentLike(commentId, liked),
    onMutate: async ({ commentId, liked }) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.comments(postId) });
      const previous = queryClient.getQueryData<Comment[]>(feedKeys.comments(postId));
      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (old = []) =>
        old.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                likedByMe: !liked,
                likes: liked ? Math.max(0, comment.likes - 1) : comment.likes + 1
              }
            : comment
        )
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(feedKeys.comments(postId), context.previous);
    }
  });
};

export const useDeleteComment = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => postService.deleteComment(commentId),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (old = []) =>
        old.filter((comment) => comment.id !== commentId)
      );
      patchPostEverywhere(queryClient, postId, (post) => ({
        ...post,
        comments: Math.max(0, post.comments - 1)
      }));
    }
  });
};

export const useOptimisticPostLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => postService.togglePostLike(postId, liked),
    onMutate: async ({ postId, liked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['feed'] }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) })
      ]);
      const previousFeedQueries = snapshotFeedQueries(queryClient);
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const patch = (post: Post): Post => ({
        ...post,
        likedByMe: !liked,
        likes: liked ? Math.max(0, post.likes - 1) : post.likes + 1
      });

      patchPostEverywhere(queryClient, postId, patch);

      return { previousFeedQueries, previousPost, postId };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousFeedQueries);
      if (context?.previousPost) {
        queryClient.setQueryData(feedKeys.post(context.postId), context.previousPost);
      }
    }
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postService.deletePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.setQueriesData<unknown>({ queryKey: ['feed'] }, (old: unknown) => removePostFromQueryData(old, postId));
      void queryClient.removeQueries({ queryKey: feedKeys.post(postId) });
      void queryClient.removeQueries({ queryKey: feedKeys.comments(postId) });
    }
  });
};

export const useOptimisticPostSave = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, saved }: { postId: string; saved: boolean }) => postService.togglePostSave(postId, saved),
    onMutate: async ({ postId, saved }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['feed'] }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) })
      ]);
      const previousFeedQueries = snapshotFeedQueries(queryClient);
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const cachedPost = getCachedPost(queryClient, postId);
      const patch = (post: Post): Post => ({
        ...post,
        savedByMe: !saved
      });

      patchPostEverywhere(queryClient, postId, patch);
      queryClient.setQueryData<Post[]>(feedKeys.savedPosts, (old) => {
        if (!old) return old;
        if (saved) return old.filter((post) => post.id !== postId);
        if (!cachedPost || old.some((post) => post.id === postId)) return old;
        return [patch(cachedPost), ...old];
      });

      return { previousFeedQueries, previousPost, postId };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousFeedQueries);
      if (context?.previousPost) {
        queryClient.setQueryData(feedKeys.post(context.postId), context.previousPost);
      }
    }
  });
};

export const usePostRealtimeUpdates = (postId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId) return undefined;

    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidation = (includeComments: boolean) => {
      if (invalidateTimer) return;

      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        void queryClient.invalidateQueries({ queryKey: feedKeys.post(postId) });
        void queryClient.invalidateQueries({ queryKey: ['feed'] });
        if (includeComments) {
          void queryClient.invalidateQueries({ queryKey: feedKeys.comments(postId) });
        }
      }, 350);
    };

    const channel = supabase
      .channel(`post-social:${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${postId}` },
        () => scheduleInvalidation(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => scheduleInvalidation(true)
      )
      .subscribe();

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      void supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);
};
