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
  CreateEvent: undefined;
  UserProfile: { userId: string };
  StoryViewer: { storyId: string };
  CreateStory: undefined;
  NewMessage: undefined;
  Chat: { conversationId: string };
  FindPlayers: undefined;
  CreatePost: { initialKind?: 'post' | 'thread' | 'stats' | 'highlight' } | undefined;
  PostDetail: { postId: string };
  GroupDetail: { communityId: string };
  PageDetail: { communityId: string };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
