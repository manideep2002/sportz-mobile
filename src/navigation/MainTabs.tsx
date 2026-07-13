import { useEffect, useRef, useState } from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CalendarDays, Grid2X2, MessageCircle, Plus, type LucideIcon } from 'lucide-react-native';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui';
import { colors, typography } from '@/design/tokens';
import { useConversations } from '@/hooks/useMessages';
import { EventsScreen } from '@/screens/events/EventsScreen';
import { FeedScreen } from '@/screens/feed/FeedScreen';
import { MessagesScreen } from '@/screens/messages/MessagesScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { CreateActionSheet } from './CreateActionSheet';
import type { MainTabParamList } from './routes';

const TAB_BAR_HEIGHT = 60;
const TAB_BAR_RADIUS = TAB_BAR_HEIGHT / 2;
const TAB_BAR_HORIZONTAL_INSET = 12;
const TAB_BAR_MIN_BOTTOM_GAP = 12;
const TAB_BAR_CONTENT_INSET = 4;
const TAB_ICON_SIZE = 22;
const TAB_ICON_FRAME_HEIGHT = 30;
const TAB_LABEL_BLOCK_HEIGHT = 13;
const TAB_CONTENT_TOP = (TAB_BAR_HEIGHT - TAB_ICON_FRAME_HEIGHT - TAB_LABEL_BLOCK_HEIGHT) / 2;
const INDICATOR_HORIZONTAL_PADDING = 12;
const FALLBACK_INDICATOR_WIDTH = TAB_ICON_SIZE + INDICATOR_HORIZONTAL_PADDING * 2;

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const profile = useAuthStore((state) => state.profile);
  const openCreateSheet = useUiStore((state) => state.openCreateSheet);
  const createSheetOpen = useUiStore((state) => state.createSheetOpen);
  const notificationUnreadCount = useUiStore((state) => state.notificationUnreadCount);
  const { data: conversations = [] } = useConversations();
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const notificationBadge =
    notificationUnreadCount > 99 ? '99+' : notificationUnreadCount > 0 ? notificationUnreadCount : undefined;
  const profileLabel = profile?.displayName.trim() || 'Profile';

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <NativeGlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.orange[500],
          tabBarInactiveTintColor: colors.text.tertiary,
          tabBarLabelStyle: styles.label
        }}
      >
        <Tab.Screen
          name="FeedTab"
          component={FeedScreen}
          options={{ title: 'Feed', tabBarIcon: TabIcon(Grid2X2) }}
        />
        <Tab.Screen
          name="EventsTab"
          component={EventsScreen}
          options={{ title: 'Events', tabBarIcon: TabIcon(CalendarDays) }}
        />
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
            title: 'Create',
            tabBarIcon: () => <CreateTabIcon highlighted={createSheetOpen} />
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
            title: profileLabel,
            tabBarAccessibilityLabel: `${profile?.displayName ?? 'Profile'} profile`,
            tabBarIcon: ({ focused }) => (
              <ProfileTabIcon
                focused={focused}
                initials={profile?.initials ?? '??'}
                avatarUrl={profile?.avatarUrl}
              />
            ),
            tabBarBadge: notificationBadge,
            tabBarBadgeStyle: styles.badge
          }}
        />
      </Tab.Navigator>
      <CreateActionSheet />
    </>
  );
}

function NativeGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const [indicatorWidths, setIndicatorWidths] = useState<number[]>([]);
  const indicatorLeft = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(FALLBACK_INDICATOR_WIDTH)).current;
  const hasPositionedIndicator = useRef(false);
  const previousBarWidth = useRef(0);
  const activeIndicatorWidth = indicatorWidths[state.index] ?? FALLBACK_INDICATOR_WIDTH;

  useEffect(() => {
    if (barWidth === 0) {
      return;
    }

    const itemWidth = (barWidth - TAB_BAR_CONTENT_INSET * 2) / state.routes.length;
    const targetLeft =
      TAB_BAR_CONTENT_INSET + itemWidth * state.index + (itemWidth - activeIndicatorWidth) / 2;
    const barWidthChanged = previousBarWidth.current !== barWidth;

    indicatorLeft.stopAnimation();
    indicatorWidth.stopAnimation();
    if (!hasPositionedIndicator.current || barWidthChanged) {
      indicatorLeft.setValue(targetLeft);
      indicatorWidth.setValue(activeIndicatorWidth);
      hasPositionedIndicator.current = true;
    } else {
      Animated.parallel([
        Animated.spring(indicatorLeft, {
          toValue: targetLeft,
          damping: 28,
          stiffness: 320,
          mass: 0.85,
          useNativeDriver: false
        }),
        Animated.spring(indicatorWidth, {
          toValue: activeIndicatorWidth,
          damping: 28,
          stiffness: 320,
          mass: 0.85,
          useNativeDriver: false
        })
      ]).start();
    }

    previousBarWidth.current = barWidth;
  }, [activeIndicatorWidth, barWidth, indicatorLeft, indicatorWidth, state.index, state.routes.length]);

  const handleBarLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setBarWidth((currentWidth) => (Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth));
  };

  const handleIconLayout = (index: number, event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setIndicatorWidths((currentWidths) => {
      if (Math.abs((currentWidths[index] ?? 0) - nextWidth) < 0.5) {
        return currentWidths;
      }

      const nextWidths = [...currentWidths];
      nextWidths[index] = nextWidth;
      return nextWidths;
    });
  };

  return (
    <View
      onLayout={handleBarLayout}
      style={[styles.tabBar, { bottom: Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_GAP) }]}
    >
      <View pointerEvents="none" style={styles.glassClip}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 90}
          tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : 'dark'}
          style={styles.blurContainer}
        />
      </View>

      {barWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.activeIndicator, { left: indicatorLeft, width: indicatorWidth }]}
        />
      ) : null}

      <View style={styles.tabItems}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index].key === route.key;
          const isCreate = route.name === 'CreateTab';
          const color = isCreate || focused ? colors.orange[500] : colors.text.tertiary;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name.replace(/Tab$/, '');
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onLongPress={onLongPress}
              onPress={onPress}
              testID={options.tabBarTestID}
              style={({ pressed }) => [styles.tabItem, pressed ? styles.tabItemPressed : null]}
            >
              <View style={styles.iconFrame} onLayout={(event) => handleIconLayout(index, event)}>
                {options.tabBarIcon?.({ focused, color, size: TAB_ICON_SIZE })}
                {badge !== undefined ? (
                  <Text numberOfLines={1} style={[styles.badge, options.tabBarBadgeStyle]}>
                    {badge}
                  </Text>
                ) : null}
              </View>
              <Text
                adjustsFontSizeToFit={route.name === 'ProfileTab'}
                minimumFontScale={0.72}
                numberOfLines={1}
                style={[
                  styles.label,
                  { color },
                  focused ? styles.selectedLabel : null,
                  isCreate ? styles.createLabel : null
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CreateTabIcon({ highlighted }: { highlighted: boolean }) {
  return (
    <View style={[styles.createIcon, highlighted ? styles.createIconHighlighted : null]}>
      <Plus size={18} color={colors.light[0]} strokeWidth={2.6} />
    </View>
  );
}

function ProfileTabIcon({
  focused,
  initials,
  avatarUrl
}: {
  focused: boolean;
  initials: string;
  avatarUrl?: string | null;
}) {
  return (
    <View style={[styles.profileAvatarRing, focused ? styles.profileAvatarRingFocused : null]}>
      <Avatar initials={initials} uri={avatarUrl} size={22} />
    </View>
  );
}

const TabIcon = (Icon: LucideIcon) => {
  const Component = ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Icon size={size} color={color} strokeWidth={focused ? 2.2 : 1.8} />
  );
  Component.displayName = `TabIcon(${typeof Icon === 'function' ? Icon.name ?? 'icon' : 'icon'})`;
  return Component;
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: TAB_BAR_HORIZONTAL_INSET,
    right: TAB_BAR_HORIZONTAL_INSET,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 20
      },
      android: {
        elevation: 12
      }
    })
  },
  glassClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'hidden'
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(10,9,7,0.92)'
  },
  activeIndicator: {
    position: 'absolute',
    top: TAB_CONTENT_TOP,
    height: TAB_ICON_FRAME_HEIGHT,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)'
  },
  tabItems: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    paddingHorizontal: TAB_BAR_CONTENT_INSET
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabItemPressed: {
    opacity: 0.72
  },
  iconFrame: {
    height: TAB_ICON_FRAME_HEIGHT,
    paddingHorizontal: INDICATOR_HORIZONTAL_PADDING,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    lineHeight: 12,
    marginTop: 1
  },
  selectedLabel: {
    fontFamily: typography.bodyBold
  },
  createLabel: {
    fontFamily: typography.bodyBold
  },
  createIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange[500],
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 6,
    elevation: 3
  },
  createIconHighlighted: {
    transform: [{ scale: 1.06 }],
    shadowOpacity: 0.55,
    shadowRadius: 9
  },
  profileAvatarRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileAvatarRingFocused: {
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.32,
    shadowRadius: 4
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    backgroundColor: colors.semantic.danger,
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 9,
    lineHeight: 16,
    textAlign: 'center',
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    overflow: 'hidden'
  }
});
