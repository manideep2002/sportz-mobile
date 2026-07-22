import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { sportzDarkTheme, sportzLightTheme } from '@/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
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
import { CreatePostScreen } from '@/screens/feed/CreatePostScreen';
import { PostDetailScreen } from '@/screens/feed/PostDetailScreen';
import { CreateStoryScreen } from '@/screens/feed/CreateStoryScreen';
import { StoryViewerScreen } from '@/screens/feed/StoryViewerScreen';
import { GroupDetailScreen } from '@/screens/community/GroupDetailScreen';
import { PageDetailScreen } from '@/screens/community/PageDetailScreen';
import { SavedPostsScreen } from '@/screens/profile/SavedPostsScreen';
import { FollowersScreen } from '@/screens/profile/FollowersScreen';
import { FollowRequestsScreen } from '@/screens/profile/FollowRequestsScreen';
import { CourtBookingScreen } from '@/screens/courts/CourtBookingScreen';
import { CourtDetailScreen } from '@/screens/courts/CourtDetailScreen';
import { CourtBookingsScreen } from '@/screens/courts/CourtBookingsScreen';
import { CreateCommunityScreen } from '@/screens/community/CreateCommunityScreen';
import { PrivacyScreen } from '@/screens/settings/PrivacyScreen';
import { NotificationSettingsScreen } from '@/screens/settings/NotificationSettingsScreen';
import { ModerationScreen } from '@/screens/settings/ModerationScreen';
import { LanguageScreen } from '@/screens/settings/LanguageScreen';
import { AppearanceScreen } from '@/screens/settings/AppearanceScreen';
import { SportsInterestsScreen } from '@/screens/settings/SportsInterestsScreen';
import { HelpScreen } from '@/screens/settings/HelpScreen';
import { ProfileCompletionScreen, ProfileLoadErrorScreen } from '@/screens/auth/AuthProfileGateScreens';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';

const Root = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();
const App = createNativeStackNavigator<AppStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['sportz://'],
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
          PostDetail: 'post/:postId',
          UserProfile: 'profile/:userId',
          EventDetail: 'event/:eventId'
        }
      }
    }
  }
};

function AuthNavigator() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const initialRouteName = authStatus === 'passwordRecovery'
    ? 'ResetPassword'
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
      <App.Screen name="CreatePost" component={CreatePostScreen} />
      <App.Screen name="PostDetail" component={PostDetailScreen} />
      <App.Screen name="GroupDetail" component={GroupDetailScreen} />
      <App.Screen name="PageDetail" component={PageDetailScreen} />
      <App.Screen name="SavedPosts" component={SavedPostsScreen} />
      <App.Screen name="Followers" component={FollowersScreen} />
      <App.Screen name="FollowRequests" component={FollowRequestsScreen} />
      <App.Screen name="CourtDetail" component={CourtDetailScreen} />
      <App.Screen name="CourtBooking" component={CourtBookingScreen} />
      <App.Screen name="CourtBookings" component={CourtBookingsScreen} />
      <App.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <App.Screen name="Privacy" component={PrivacyScreen} />
      <App.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <App.Screen name="Moderation" component={ModerationScreen} />
      <App.Screen name="Language" component={LanguageScreen} />
      <App.Screen name="Appearance" component={AppearanceScreen} />
      <App.Screen name="SportsInterests" component={SportsInterestsScreen} />
      <App.Screen name="Help" component={HelpScreen} />
    </App.Navigator>
  );
}

export function RootNavigator() {
  const profile = useAuthStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const authStatus = useAuthStore((state) => state.authStatus);
  const themeMode = useUiStore((state) => state.themeMode);
  const theme = themeMode === 'light' ? sportzLightTheme : sportzDarkTheme;
  const authenticated = authStatus === 'signedIn' && Boolean(session && profile);

  if (authStatus === 'initializing' || authStatus === 'loadingProfile') {
    return (
      <View style={styles.authLoading}>
        <ActivityIndicator color={colors.orange[500]} />
        <AppText variant="bodyMuted">Loading your athlete profile...</AppText>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={theme} linking={linking}>
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
