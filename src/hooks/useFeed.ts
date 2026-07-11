import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { mapProfileRow } from '@/services/profileMapper';
import { postService, type CreatePostInput, type UpdatePostInput } from '@/services/postService';
import { useAuthStore } from '@/store/authStore';
import type { Comment, Post } from '@/types/domain';

export const feedKeys = {
  infinite: ['feed', 'infinite'] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  userPosts: (userId: string) => ['feed', 'user', userId] as const,
  communityPosts: (communityId: string) => ['feed', 'community', communityId] as const,
  savedPosts: ['feed', 'saved'] as const
};

export const useInfiniteFeed = () =>
  useInfiniteQuery({
    queryKey: feedKeys.infinite,
    queryFn: ({ pageParam }) => postService.listFeedPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });

export const useUserPosts = (userId: string) =>
  useQuery({
    queryKey: feedKeys.userPosts(userId),
    queryFn: () => postService.listUserPosts(userId)
  });

export const useCommunityPosts = (communityId: string) =>
  useQuery({
    queryKey: feedKeys.communityPosts(communityId),
    queryFn: () => postService.listCommunityPosts(communityId),
    enabled: !!communityId
  });

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

export const useComments = (postId: string) =>
  useQuery({
    queryKey: feedKeys.comments(postId),
    queryFn: () => postService.listComments(postId)
  });

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => postService.createPost(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: feedKeys.infinite });
      void queryClient.invalidateQueries({ queryKey: ['feed', 'user'] });
    }
  });
};

export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      postService.updatePost(postId, input),
    onSuccess: (post) => {
      queryClient.setQueryData(feedKeys.post(post.id), post);
      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(post.id, () => post));
      void queryClient.invalidateQueries({ queryKey: ['feed', 'user'] });
      if (post.author.id) {
        void queryClient.invalidateQueries({ queryKey: feedKeys.userPosts(post.author.id) });
      }
      void queryClient.invalidateQueries({ queryKey: ['feed', 'community'] });
    }
  });
};

const patchFeedPost = (postId: string, patch: (post: Post) => Post) => (old: {
  pages: { items: Post[]; nextCursor?: string }[];
  pageParams: unknown[];
} | undefined) =>
  old
    ? {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((post) => (post.id === postId ? patch(post) : post))
        }))
      }
    : old;

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
        queryClient.cancelQueries({ queryKey: feedKeys.infinite })
      ]);

      const previousComments = queryClient.getQueryData<Comment[]>(feedKeys.comments(postId));
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const previousFeed = queryClient.getQueryData<{
        pages: { items: Post[]; nextCursor?: string }[];
        pageParams: unknown[];
      }>(feedKeys.infinite);
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
      queryClient.setQueryData<Post>(feedKeys.post(postId), (old) =>
        old ? { ...old, comments: old.comments + 1 } : old
      );
      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(postId, (post) => ({ ...post, comments: post.comments + 1 })));

      return { previousComments, previousPost, previousFeed, optimisticId };
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
      if (context?.previousFeed) {
        queryClient.setQueryData(feedKeys.infinite, context.previousFeed);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedKeys.post(postId) });
    }
  });
};

export const useRecordPostShare = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postService.recordPostShare(postId),
    onMutate: async (postId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedKeys.infinite }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) })
      ]);
      const previousFeed = queryClient.getQueryData<{
        pages: { items: Post[]; nextCursor?: string }[];
        pageParams: unknown[];
      }>(feedKeys.infinite);
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const patch = (post: Post): Post => ({ ...post, shares: post.shares + 1 });

      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(postId, patch));
      queryClient.setQueryData<Post>(feedKeys.post(postId), (old) => (old ? patch(old) : old));

      return { previousFeed, previousPost, postId };
    },
    onError: (_error, _postId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(feedKeys.infinite, context.previousFeed);
      }
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
      queryClient.setQueryData<Post>(feedKeys.post(postId), (old) =>
        old ? { ...old, comments: Math.max(0, old.comments - 1) } : old
      );
      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(postId, (post) => ({
        ...post,
        comments: Math.max(0, post.comments - 1)
      })));
    }
  });
};

export const useOptimisticPostLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => postService.togglePostLike(postId, liked),
    onMutate: async ({ postId, liked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedKeys.infinite }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) })
      ]);
      const previousFeed = queryClient.getQueryData<{
        pages: { items: Post[]; nextCursor?: string }[];
        pageParams: unknown[];
      }>(feedKeys.infinite);
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const patch = (post: Post): Post => ({
        ...post,
        likedByMe: !liked,
        likes: liked ? Math.max(0, post.likes - 1) : post.likes + 1
      });

      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(postId, patch));
      queryClient.setQueryData<Post>(feedKeys.post(postId), (old) => (old ? patch(old) : old));

      return { previousFeed, previousPost, postId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(feedKeys.infinite, context.previousFeed);
      }
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
      // Remove post from infinite feed
      queryClient.setQueryData(feedKeys.infinite, (old: {
        pages: { items: Post[]; nextCursor?: string }[];
        pageParams: unknown[];
      } | undefined) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.filter((post) => post.id !== postId)
              }))
            }
          : old
      );
      // Invalidate related queries
      void queryClient.invalidateQueries({ queryKey: ['feed', 'user'] });
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
        queryClient.cancelQueries({ queryKey: feedKeys.infinite }),
        queryClient.cancelQueries({ queryKey: feedKeys.post(postId) })
      ]);
      const previousFeed = queryClient.getQueryData<{
        pages: { items: Post[]; nextCursor?: string }[];
        pageParams: unknown[];
      }>(feedKeys.infinite);
      const previousPost = queryClient.getQueryData<Post>(feedKeys.post(postId));
      const patch = (post: Post): Post => ({
        ...post,
        savedByMe: !saved
      });

      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(postId, patch));
      queryClient.setQueryData<Post>(feedKeys.post(postId), (old) => (old ? patch(old) : old));

      return { previousFeed, previousPost, postId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(feedKeys.infinite, context.previousFeed);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(feedKeys.post(context.postId), context.previousPost);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedKeys.savedPosts });
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
        void queryClient.invalidateQueries({ queryKey: feedKeys.infinite });
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
