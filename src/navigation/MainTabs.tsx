import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, Grid2X2, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

import { colors, layout, typography } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import { useNotifications } from '@/hooks/useNotifications';
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
  const { data: notifications = [] } = useNotifications();
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const unreadNotifications = notifications.some((notification) => !notification.read);

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
          tabBarItemStyle: styles.item,
          tabBarBackground: () => (
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 90}
              tint="dark"
              style={styles.blurContainer}
            />
          )
        }}
      >
<Tab.Screen name="FeedTab" component={FeedScreen} options={{ title: 'Feed', tabBarIcon: TabIcon(Grid2X2) }} />
         <Tab.Screen name="EventsTab" component={EventsScreen} options={{ title: 'Events', tabBarIcon: TabIcon(CalendarDays) }} />
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
             tabBarIcon: TabIcon(MessageCircle),
             tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
             tabBarBadgeStyle: styles.badge
           }}
         />
         <Tab.Screen
           name="ProfileTab"
           component={ProfileScreen}
           options={{
             title: 'Profile',
             tabBarIcon: TabIcon(UserRound),
             tabBarBadge: unreadNotifications ? '' : undefined,
             tabBarBadgeStyle: styles.dotBadge
           }}
         />
      </Tab.Navigator>
      <CreateActionSheet />
    </>
  );
}

const TabIcon = (Icon: LucideIcon) => {
  const Component = ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={[styles.iconWrap, focused ? styles.iconActive : null]}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
  Component.displayName = `TabIcon(${typeof Icon === 'function' ? Icon.name ?? 'icon' : 'icon'})`;
  return Component;
};

const styles = StyleSheet.create({
  tabBar: {
    height: layout.tabBarHeight,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingTop: 10,
    paddingBottom: 18,
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24
      },
      android: {
        elevation: 12
      }
    })
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(10,9,7,0.75)' : 'rgba(10,9,7,0.92)',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden'
  },
  item: {
    paddingTop: 0
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconActive: {
    backgroundColor: colors.overlays.orangeSoft
  },
  label: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    marginTop: 2
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: 'rgba(10,9,7,0.4)',
    ...Platform.select({
      ios: {
        shadowColor: colors.orange[500],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20
      },
      android: {
        elevation: 8
      }
    })
  },
  badge: {
    backgroundColor: colors.semantic.danger,
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.dark[950]
  },
  dotBadge: {
    backgroundColor: colors.semantic.danger,
    minWidth: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    color: 'transparent',
    borderWidth: 1,
    borderColor: colors.dark[950]
  }
});
