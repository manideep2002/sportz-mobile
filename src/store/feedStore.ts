import { create } from 'zustand';

interface FeedState {
  likedPosts: Record<string, boolean>;
  toggleLocalLike: (postId: string, liked: boolean) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  likedPosts: {},
  toggleLocalLike: (postId, liked) =>
    set((state) => ({
      likedPosts: {
        ...state.likedPosts,
        [postId]: liked
      }
    }))
}));
