import { CalendarPlus, Camera, Search, Trophy } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { AppText, BottomSheet } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useUiStore } from '@/store/uiStore';
import type { AppStackParamList } from './routes';

const actions = [
  { label: 'New Post', detail: 'Share a photo, video or text update', icon: Trophy, route: 'CreatePost', kind: 'post' },
  { label: 'New Story', detail: 'Share a 24-hour moment', icon: Camera, route: 'CreateStory' },
  { label: 'New Event', detail: 'Schedule a game or practice', icon: CalendarPlus, route: 'CreateEvent' },
  { label: 'Find Players', detail: 'Browse athletes and teammates', icon: Search, route: 'FindPlayers' }
] as const;

export function CreateActionSheet() {
  const open = useUiStore((state) => state.createSheetOpen);
  const close = useUiStore((state) => state.closeCreateSheet);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  return (
    <BottomSheet open={open} title="Create" onClose={close}>
      <View>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            style={styles.option}
            onPress={() => {
              close();
              if (action.route === 'CreatePost') {
                navigation.navigate('CreatePost', { initialKind: action.kind });
              } else if (action.route === 'CreateStory') {
                navigation.navigate('CreateStory');
              } else if (action.route === 'CreateEvent') {
                navigation.navigate('CreateEvent');
              } else {
                navigation.navigate('FindPlayers');
              }
            }}
          >
            <View style={styles.iconWrap}>
              <action.icon size={22} color={colors.orange[500]} strokeWidth={2.1} />
            </View>
            <View style={styles.meta}>
              <AppText style={styles.label}>{action.label}</AppText>
              <AppText variant="small">{action.detail}</AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft
  },
  meta: {
    flex: 1
  },
  label: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  }
});
