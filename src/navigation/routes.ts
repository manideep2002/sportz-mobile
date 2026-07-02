import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  FeedTab: undefined;
  EventsTab: undefined;
  CreateTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Search: undefined;
  Courts: undefined;
  Community: undefined;
  Notifications: undefined;
  Settings: undefined;
  EditProfile: undefined;
  EventDetail: { eventId: string };
  EventChat: { eventId: string };
  ManageEvent: { eventId: string };
  CreateEvent: undefined;
  UserProfile: { userId: string };
  StoryViewer: { storyId: string; mediaUrl?: string };
  CreateStory: undefined;
  NewMessage: { addToConversationId?: string } | undefined;
  Chat: { conversationId: string; targetUserId?: string };
  FindPlayers: undefined;
  CreatePost: { initialKind?: 'post' | 'thread' | 'stats' | 'highlight'; communityId?: string; editPostId?: string } | undefined;
  PostDetail: { postId: string };
  GroupDetail: { communityId: string };
  PageDetail: { communityId: string };
  SavedPosts: undefined;
  Followers: { userId: string; mode: 'followers' | 'following' };
  FollowRequests: undefined;
  CourtDetail: { courtId: string };
  CourtBooking: { courtId: string };
  CourtBookings: { courtId?: string } | undefined;
  CreateCommunity: undefined;
  Privacy: undefined;
  NotificationSettings: undefined;
  Moderation: undefined;
  Language: undefined;
  Appearance: undefined;
  SportsInterests: undefined;
  Help: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
