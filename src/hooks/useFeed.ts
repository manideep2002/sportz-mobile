import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postService, type CreatePostInput } from '@/services/postService';
import type { Comment, Post } from '@/types/domain';

export const feedKeys = {
  infinite: ['feed', 'infinite'] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  userPosts: (userId: string) => ['feed', 'user', userId] as const
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

export const usePost = (postId: string) =>
  useQuery({
    queryKey: feedKeys.post(postId),
    queryFn: () => postService.getPost(postId)
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
      void queryClient.invalidateQueries({ queryKey: feedKeys.infinite });
      void queryClient.invalidateQueries({ queryKey: ['feed', 'user'] });
    }
  });
};

const patchFeedPost = (postId: string, patch: (post: Post) => Post) => (old: {
  pages: Array<{ items: Post[]; nextCursor?: string }>;
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

  return useMutation({
    mutationFn: (body: string) => postService.createComment(postId, body),
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (old = []) => [...old, comment]);
      queryClient.setQueryData<Post>(feedKeys.post(postId), (old) =>
        old ? { ...old, comments: old.comments + 1 } : old
      );
      queryClient.setQueryData(feedKeys.infinite, patchFeedPost(postId, (post) => ({ ...post, comments: post.comments + 1 })));
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
        pages: Array<{ items: Post[]; nextCursor?: string }>;
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
