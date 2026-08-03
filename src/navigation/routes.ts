import type { NavigatorScreenParams } from '@react-navigation/native';

import type { StructuredSport } from '@/types/domain';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  ProfileCompletion: undefined;
  ProfileLoadError: undefined;
  MfaChallenge: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
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
  AccountSecurity: undefined;
  EditProfile: undefined;
  EventDetail: { eventId: string };
  EventChat: { eventId: string };
  ManageEvent: { eventId: string };
  CreateEvent: { communityId?: string } | undefined;
  UserProfile: { userId: string };
  StoryViewer: { storyId: string; mediaUrl?: string; mediaKind?: 'image' | 'video' };
  CreateStory: undefined;
  NewMessage: { addToConversationId?: string } | undefined;
  Chat: { conversationId: string; targetUserId?: string; openSettings?: boolean };
  FindPlayers: undefined;
  CreateOffer: { recipientId: string };
  Offers: { initialDirection?: 'incoming' | 'outgoing' } | undefined;
  OfferDetail: { offerId: string };
  StatsEntry: { sport?: StructuredSport } | undefined;
  MatchHistory: {
    userId?: string;
    sport?: StructuredSport;
    seasonId?: string;
  } | undefined;
  VerificationQueue: undefined;
  VerificationDetail: { matchId: string };
  CreatePost: { initialKind?: 'post' | 'thread' | 'stats' | 'highlight'; communityId?: string; editPostId?: string } | undefined;
  PostDetail: { postId: string; commentId?: string };
  GroupDetail: { communityId: string };
  PageDetail: { communityId: string };
  CommunityAdmin: { communityId: string };
  CommunityInvitation: { inviteId: string };
  SavedPosts: undefined;
  Followers: { userId: string; mode: 'followers' | 'following' };
  FollowRequests: undefined;
  CourtDetail: { courtId: string };
  CourtBooking: { courtId: string };
  CourtBookings: { courtId?: string; admin?: boolean } | undefined;
  CourtBookingDetail: { bookingId: string; admin?: boolean };
  CreateCommunity: undefined;
  Privacy: undefined;
  NotificationSettings: undefined;
  Moderation: undefined;
  ModerationDetail: { reportId: string };
  SportsInterests: undefined;
  Help: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
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
