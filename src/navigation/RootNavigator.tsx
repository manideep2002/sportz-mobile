import {
  NavigationContainer,
  type LinkingOptions,
  type NavigatorScreenParams
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { createNavigationTheme } from '@/design/theme';
import { useAppTheme } from '@/design/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { MainTabs } from './MainTabs';
import { navigationRef } from './navigationRef';
import type { AppStackParamList, AuthStackParamList, RootStackParamList } from './routes';
import { SplashScreen } from '@/screens/auth/SplashScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';
import { SearchScreen } from '@/screens/feed/SearchScreen';
import { CourtsScreen } from '@/screens/courts/CourtsScreen';
import { CommunityScreen } from '@/screens/community/CommunityScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { EventDetailScreen } from '@/screens/events/EventDetailScreen';
import { EventChatScreen } from '@/screens/events/EventChatScreen';
import { ManageEventScreen } from '@/screens/events/ManageEventScreen';
import { CreateEventScreen } from '@/screens/events/CreateEventScreen';
import { UserProfileScreen } from '@/screens/profile/UserProfileScreen';
import { ChatScreen } from '@/screens/messages/ChatScreen';
import { NewMessageScreen } from '@/screens/messages/NewMessageScreen';
import { FindPlayersScreen } from '@/screens/profile/FindPlayersScreen';
import { CreateOfferScreen } from '@/screens/offers/CreateOfferScreen';
import { OffersScreen } from '@/screens/offers/OffersScreen';
import { OfferDetailScreen } from '@/screens/offers/OfferDetailScreen';
import { StatsEntryScreen } from '@/screens/stats/StatsEntryScreen';
import { MatchHistoryScreen } from '@/screens/stats/MatchHistoryScreen';
import { VerificationQueueScreen } from '@/screens/stats/VerificationQueueScreen';
import { VerificationDetailScreen } from '@/screens/stats/VerificationDetailScreen';
import { CreatePostScreen } from '@/screens/feed/CreatePostScreen';
import { PostDetailScreen } from '@/screens/feed/PostDetailScreen';
import { CreateStoryScreen } from '@/screens/feed/CreateStoryScreen';
import { StoryViewerScreen } from '@/screens/feed/StoryViewerScreen';
import { GroupDetailScreen } from '@/screens/community/GroupDetailScreen';
import { PageDetailScreen } from '@/screens/community/PageDetailScreen';
import { CommunityAdminScreen } from '@/screens/community/CommunityAdminScreen';
import { CommunityInvitationScreen } from '@/screens/community/CommunityInvitationScreen';
import { SavedPostsScreen } from '@/screens/profile/SavedPostsScreen';
import { FollowersScreen } from '@/screens/profile/FollowersScreen';
import { FollowRequestsScreen } from '@/screens/profile/FollowRequestsScreen';
import { CourtBookingScreen } from '@/screens/courts/CourtBookingScreen';
import { CourtDetailScreen } from '@/screens/courts/CourtDetailScreen';
import { CourtBookingsScreen } from '@/screens/courts/CourtBookingsScreen';
import { CourtBookingDetailScreen } from '@/screens/courts/CourtBookingDetailScreen';
import { CreateCommunityScreen } from '@/screens/community/CreateCommunityScreen';
import { PrivacyScreen } from '@/screens/settings/PrivacyScreen';
import { NotificationSettingsScreen } from '@/screens/settings/NotificationSettingsScreen';
import { ModerationScreen } from '@/screens/settings/ModerationScreen';
import { ModerationDetailScreen } from '@/screens/settings/ModerationDetailScreen';
import { SportsInterestsScreen } from '@/screens/settings/SportsInterestsScreen';
import { HelpScreen } from '@/screens/settings/HelpScreen';
import { ProfileCompletionScreen, ProfileLoadErrorScreen } from '@/screens/auth/AuthProfileGateScreens';
import { MfaChallengeScreen } from '@/screens/auth/MfaChallengeScreen';
import { AccountSecurityScreen } from '@/screens/settings/AccountSecurityScreen';
import { LegalDocumentScreen } from '@/screens/legal/LegalDocumentScreen';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useAppTranslation } from '@/i18n';
import {
  recordNavigationRoute,
  registerNavigationContainer
} from '@/lib/monitoring';
import { env } from '@/lib/env';
import {
  parseCanonicalDestination,
  pendingCanonicalDestination
} from '@/services/canonicalLinkService';
import { openPendingNotificationDestination } from '@/navigation/notificationRouting';

const Root = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();
const App = createNativeStackNavigator<AppStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [`${env.appScheme}://`, env.canonicalWebUrl],
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (!url || !parseCanonicalDestination(url)) return url;
    if (useAuthStore.getState().authStatus !== 'signedIn') {
      await pendingCanonicalDestination.save(url);
      return null;
    }
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (parseCanonicalDestination(url) && useAuthStore.getState().authStatus !== 'signedIn') {
        void pendingCanonicalDestination.save(url);
        return;
      }
      listener(url);
    });
    return () => subscription.remove();
  },
  config: {
    screens: {
      Auth: {
        screens: {
          // The Supabase reset-password email link opens this route.
          // The SDK automatically exchanges the token and emits PASSWORD_RECOVERY.
          ResetPassword: 'reset-password'
        }
      },
      App: {
        screens: {
          PostDetail: 'posts/:postId',
          UserProfile: 'profiles/:userId',
          EventDetail: 'events/:eventId',
          CourtDetail: 'courts/:courtId',
          GroupDetail: 'groups/:communityId',
          PageDetail: 'pages/:communityId',
          CommunityInvitation: 'invitations/community/:inviteId',
          CourtBookingDetail: 'booking/:bookingId',
          OfferDetail: 'offer/:offerId'
        }
      }
    }
  }
};

function AuthNavigator() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const initialRouteName = authStatus === 'passwordRecovery'
    ? 'ResetPassword'
    : authStatus === 'mfaChallenge'
      ? 'MfaChallenge'
    : authStatus === 'profileCompletion'
      ? 'ProfileCompletion'
      : authStatus === 'profileError'
        ? 'ProfileLoadError'
        : 'Splash';

  return (
    <Auth.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Splash" component={SplashScreen} />
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="Register" component={RegisterScreen} />
      <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Auth.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Auth.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
      <Auth.Screen name="ProfileLoadError" component={ProfileLoadErrorScreen} />
      <Auth.Screen name="MfaChallenge" component={MfaChallengeScreen} />
      <Auth.Screen name="TermsOfService">
        {({ navigation }) => <LegalDocumentScreen kind="terms" onBack={() => navigation.goBack()} />}
      </Auth.Screen>
      <Auth.Screen name="PrivacyPolicy">
        {({ navigation }) => <LegalDocumentScreen kind="privacy" onBack={() => navigation.goBack()} />}
      </Auth.Screen>
    </Auth.Navigator>
  );
}

function AppNavigator() {
  return (
    <App.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <App.Screen name="MainTabs" component={MainTabs} />
      <App.Screen name="Search" component={SearchScreen} />
      <App.Screen name="Courts" component={CourtsScreen} />
      <App.Screen name="Community" component={CommunityScreen} />
      <App.Screen name="Notifications" component={NotificationsScreen} />
      <App.Screen name="Settings" component={SettingsScreen} />
      <App.Screen name="AccountSecurity" component={AccountSecurityScreen} />
      <App.Screen name="EditProfile" component={EditProfileScreen} />
      <App.Screen name="EventDetail" component={EventDetailScreen} />
      <App.Screen name="EventChat" component={EventChatScreen} />
      <App.Screen name="ManageEvent" component={ManageEventScreen} />
      <App.Screen name="CreateEvent" component={CreateEventScreen} />
      <App.Screen name="UserProfile" component={UserProfileScreen} />
      <App.Screen name="StoryViewer" component={StoryViewerScreen} options={{ animation: 'fade' }} />
      <App.Screen name="CreateStory" component={CreateStoryScreen} />
      <App.Screen name="NewMessage" component={NewMessageScreen} />
      <App.Screen name="Chat" component={ChatScreen} getId={({ params }) => params.conversationId} />
      <App.Screen name="FindPlayers" component={FindPlayersScreen} />
      <App.Screen name="CreateOffer" component={CreateOfferScreen} />
      <App.Screen name="Offers" component={OffersScreen} />
      <App.Screen name="OfferDetail" component={OfferDetailScreen} />
      <App.Screen name="StatsEntry" component={StatsEntryScreen} />
      <App.Screen name="MatchHistory" component={MatchHistoryScreen} />
      <App.Screen name="VerificationQueue" component={VerificationQueueScreen} />
      <App.Screen name="VerificationDetail" component={VerificationDetailScreen} />
      <App.Screen name="CreatePost" component={CreatePostScreen} />
      <App.Screen name="PostDetail" component={PostDetailScreen} />
      <App.Screen name="GroupDetail" component={GroupDetailScreen} />
      <App.Screen name="PageDetail" component={PageDetailScreen} />
      <App.Screen name="CommunityAdmin" component={CommunityAdminScreen} />
      <App.Screen name="CommunityInvitation" component={CommunityInvitationScreen} />
      <App.Screen name="SavedPosts" component={SavedPostsScreen} />
      <App.Screen name="Followers" component={FollowersScreen} />
      <App.Screen name="FollowRequests" component={FollowRequestsScreen} />
      <App.Screen name="CourtDetail" component={CourtDetailScreen} />
      <App.Screen name="CourtBooking" component={CourtBookingScreen} />
      <App.Screen name="CourtBookings" component={CourtBookingsScreen} />
      <App.Screen name="CourtBookingDetail" component={CourtBookingDetailScreen} />
      <App.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <App.Screen name="Privacy" component={PrivacyScreen} />
      <App.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <App.Screen name="Moderation" component={ModerationScreen} />
      <App.Screen name="ModerationDetail" component={ModerationDetailScreen} />
      <App.Screen name="SportsInterests" component={SportsInterestsScreen} />
      <App.Screen name="Help" component={HelpScreen} />
      <App.Screen name="TermsOfService">
        {({ navigation }) => <LegalDocumentScreen kind="terms" onBack={() => navigation.goBack()} />}
      </App.Screen>
      <App.Screen name="PrivacyPolicy">
        {({ navigation }) => <LegalDocumentScreen kind="privacy" onBack={() => navigation.goBack()} />}
      </App.Screen>
    </App.Navigator>
  );
}

export function RootNavigator() {
  const profile = useAuthStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const authStatus = useAuthStore((state) => state.authStatus);
  const appTheme = useAppTheme();
  const theme = createNavigationTheme(appTheme);
  const { t } = useAppTranslation();
  const authenticated = authStatus === 'signedIn' && Boolean(session && profile);

  const openPendingDestination = async () => {
    if (!authenticated || !navigationRef.isReady()) return;
    const url = await pendingCanonicalDestination.consume();
    if (!url) return;
    const destination = parseCanonicalDestination(url);
    if (!destination) return;
    navigationRef.navigate('App', {
      screen: destination.screen,
      params: destination.params
    } as NavigatorScreenParams<AppStackParamList>);
  };

  const openPendingNotification = async () => {
    await openPendingNotificationDestination(navigationRef, authenticated);
  };

  useEffect(() => {
    void openPendingDestination();
    void openPendingNotification();
    // Navigation readiness is handled by onReady; this effect handles login/profile completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  if (authStatus === 'initializing' || authStatus === 'loadingProfile') {
    return (
      <View style={[styles.authLoading, { backgroundColor: appTheme.colors.background }]}>
        <ActivityIndicator color={appTheme.colors.accent} />
        <AppText variant="bodyMuted">{t('common.loadingProfile')}</AppText>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      linking={linking}
      onReady={() => {
        registerNavigationContainer(navigationRef);
        recordNavigationRoute(navigationRef.getCurrentRoute()?.name);
        void openPendingDestination();
        void openPendingNotification();
      }}
      onStateChange={() => {
        recordNavigationRoute(navigationRef.getCurrentRoute()?.name);
      }}
    >
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {authenticated ? (
          <Root.Screen name="App" component={AppNavigator} navigationKey="signed-in" />
        ) : (
          <Root.Screen name="Auth" component={AuthNavigator} navigationKey={authStatus} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.dark[950]
  }
});
