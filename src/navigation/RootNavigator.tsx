import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { sportzDarkTheme, sportzLightTheme } from '@/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { MainTabs } from './MainTabs';
import type { AppStackParamList, AuthStackParamList, RootStackParamList } from './routes';
import { SplashScreen } from '@/screens/auth/SplashScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { SearchScreen } from '@/screens/feed/SearchScreen';
import { CourtsScreen } from '@/screens/courts/CourtsScreen';
import { CommunityScreen } from '@/screens/community/CommunityScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { EventDetailScreen } from '@/screens/events/EventDetailScreen';
import { CreateEventScreen } from '@/screens/events/CreateEventScreen';
import { UserProfileScreen } from '@/screens/profile/UserProfileScreen';
import { ChatScreen } from '@/screens/messages/ChatScreen';
import { FindPlayersScreen } from '@/screens/profile/FindPlayersScreen';
import { CreatePostScreen } from '@/screens/feed/CreatePostScreen';
import { PostDetailScreen } from '@/screens/feed/PostDetailScreen';
import { GroupDetailScreen } from '@/screens/community/GroupDetailScreen';
import { PageDetailScreen } from '@/screens/community/PageDetailScreen';

const Root = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();
const App = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Splash" component={SplashScreen} />
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="Register" component={RegisterScreen} />
      <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
      <App.Screen name="CreateEvent" component={CreateEventScreen} />
      <App.Screen name="UserProfile" component={UserProfileScreen} />
      <App.Screen name="Chat" component={ChatScreen} />
      <App.Screen name="FindPlayers" component={FindPlayersScreen} />
      <App.Screen name="CreatePost" component={CreatePostScreen} />
      <App.Screen name="PostDetail" component={PostDetailScreen} />
      <App.Screen name="GroupDetail" component={GroupDetailScreen} />
      <App.Screen name="PageDetail" component={PageDetailScreen} />
    </App.Navigator>
  );
}

export function RootNavigator() {
  const profile = useAuthStore((state) => state.profile);
  const themeMode = useUiStore((state) => state.themeMode);
  const theme = themeMode === 'light' ? sportzLightTheme : sportzDarkTheme;

  return (
    <NavigationContainer theme={theme}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {profile ? <Root.Screen name="App" component={AppNavigator} /> : <Root.Screen name="Auth" component={AuthNavigator} />}
      </Root.Navigator>
    </NavigationContainer>
  );
}
