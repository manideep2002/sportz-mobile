import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postService, type CreatePostInput } from '@/services/postService';
import type { Post } from '@/types/domain';

export const feedKeys = {
  infinite: ['feed', 'infinite'] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const
};

export const useInfiniteFeed = () =>
  useInfiniteQuery({
    queryKey: feedKeys.infinite,
    queryFn: ({ pageParam }) => postService.listFeedPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor
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
    }
  });
};

export const useOptimisticPostLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => postService.togglePostLike(postId, liked),
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.infinite });
      const previous = queryClient.getQueryData<{
        pages: Array<{ items: Post[]; nextCursor?: string }>;
        pageParams: unknown[];
      }>(feedKeys.infinite);

      queryClient.setQueryData<{ pages: Array<{ items: Post[]; nextCursor?: string }>; pageParams: unknown[] }>(
        feedKeys.infinite,
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((post) =>
                    post.id === postId
                      ? {
                          ...post,
                          likedByMe: !liked,
                          likes: liked ? Math.max(0, post.likes - 1) : post.likes + 1
                        }
                      : post
                  )
                }))
              }
            : old
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(feedKeys.infinite, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedKeys.infinite });
    }
  });
};
