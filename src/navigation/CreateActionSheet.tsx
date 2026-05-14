import { CalendarPlus, MessageCircle, Radio, Star, Trophy, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { AppText, BottomSheet } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useUiStore } from '@/store/uiStore';
import type { AppStackParamList } from './routes';

const actions = [
  { label: 'Post', detail: 'Share a photo, video or text update', icon: Trophy, route: 'CreatePost' },
  { label: 'Share Stats', detail: 'Post game stats and performance', icon: Star, route: 'CreatePost' },
  { label: 'Create Event', detail: 'Schedule a game or practice', icon: CalendarPlus, route: 'CreateEvent' },
  { label: 'Create Group / Page', detail: 'Start a community', icon: Users, route: 'Community' },
  { label: 'Go Live', detail: 'Stream your game live', icon: Radio, route: 'CreatePost' },
  { label: 'Post a Thread', detail: 'Start a discussion', icon: MessageCircle, route: 'CreatePost' }
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
              navigation.navigate(action.route);
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
