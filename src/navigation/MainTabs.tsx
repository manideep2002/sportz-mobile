import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, Grid2X2, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, radii, shadows, typography } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import { useUiStore } from '@/store/uiStore';
import type { MainTabParamList } from './routes';
import { FeedScreen } from '@/screens/feed/FeedScreen';
import { EventsScreen } from '@/screens/events/EventsScreen';
import { MessagesScreen } from '@/screens/messages/MessagesScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { CreateActionSheet } from './CreateActionSheet';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const openCreateSheet = useUiStore((state) => state.openCreateSheet);
  const { data: conversations = [] } = useConversations();
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.orange[500],
          tabBarInactiveTintColor: colors.text.tertiary,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: styles.item
        }}
      >
        <Tab.Screen name="FeedTab" component={FeedScreen} options={{ title: 'Feed', tabBarIcon: tabIcon(Grid2X2) }} />
        <Tab.Screen name="EventsTab" component={EventsScreen} options={{ title: 'Events', tabBarIcon: tabIcon(CalendarDays) }} />
        <Tab.Screen
          name="CreateTab"
          component={FeedScreen}
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              openCreateSheet();
            }
          }}
          options={{
            title: '',
            tabBarButton: ({ onPress, accessibilityState }) => (
              <Pressable accessibilityRole="button" accessibilityState={accessibilityState} onPress={onPress} style={styles.createButton}>
                <Plus size={25} color={colors.light[0]} strokeWidth={2.5} />
              </Pressable>
            )
          }}
        />
        <Tab.Screen
          name="MessagesTab"
          component={MessagesScreen}
          options={{
            title: 'Messages',
            tabBarIcon: tabIcon(MessageCircle),
            tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
            tabBarBadgeStyle: styles.badge
          }}
        />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: tabIcon(UserRound) }} />
      </Tab.Navigator>
      <CreateActionSheet />
    </>
  );
}

const tabIcon =
  (Icon: LucideIcon) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={[styles.iconWrap, focused ? styles.iconActive : null]}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );

const styles = StyleSheet.create({
  tabBar: {
    height: layout.tabBarHeight,
    backgroundColor: colors.overlays.nav,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark[700],
    paddingTop: 10,
    paddingBottom: 18,
    position: 'absolute'
  },
  item: {
    paddingTop: 0
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconActive: {
    backgroundColor: colors.overlays.orangeSoft
  },
  label: {
    fontFamily: typography.bodyMedium,
    fontSize: 10
  },
  createButton: {
    width: 50,
    height: 50,
    borderRadius: radii.xl,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    alignSelf: 'center',
    ...shadows.orangeGlow
  },
  badge: {
    backgroundColor: colors.semantic.danger,
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 9,
    minWidth: 16,
    height: 16,
    borderRadius: 8
  }
});
