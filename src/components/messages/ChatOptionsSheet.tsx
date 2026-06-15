import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Ban,
  Bell,
  BellOff,
  Eraser,
  Flag,
  LogOut,
  Search,
  UserRound,
  Users,
  type LucideIcon
} from 'lucide-react-native';

import { AppText, BottomSheet } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useMessagingStore } from '@/store/messagingStore';

interface ChatOptionsSheetProps {
  open: boolean;
  conversationId: string;
  isGroup: boolean;
  participantName: string;
  otherUserId?: string;
  communityId?: string;
  onClose: () => void;
  onClearChat: () => void;
}

interface ChatOption {
  label: string;
  detail: string;
  icon: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
}

export function ChatOptionsSheet({
  open,
  conversationId,
  isGroup,
  participantName,
  otherUserId,
  communityId,
  onClose,
  onClearChat
}: ChatOptionsSheetProps) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const muted = useMessagingStore((state) => Boolean(state.mutedConversations[conversationId]));
  const toggleMute = useMessagingStore((state) => state.toggleMuteConversation);

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm }
    ]);
  };

  const options: ChatOption[] = [];

  if (!isGroup && otherUserId) {
    options.push({
      label: 'View profile',
      detail: `See ${participantName}'s profile and stats`,
      icon: UserRound,
      onPress: () => {
        onClose();
        navigation.navigate('UserProfile', { userId: otherUserId });
      }
    });
  }

  if (isGroup && communityId) {
    options.push({
      label: 'View group',
      detail: 'Members, posts, and group settings',
      icon: Users,
      onPress: () => {
        onClose();
        navigation.navigate('GroupDetail', { communityId });
      }
    });
  }

  options.push(
    {
      label: muted ? 'Unmute notifications' : 'Mute notifications',
      detail: muted ? 'Turn alerts back on for this chat' : 'Stop push alerts from this chat',
      icon: muted ? Bell : BellOff,
      onPress: () => {
        toggleMute(conversationId);
        onClose();
      }
    },
    {
      label: 'Search in conversation',
      detail: 'Find messages, dates, and media',
      icon: Search,
      onPress: () => {
        onClose();
        Alert.alert('Search in conversation', 'Message search will be available in a future update.');
      }
    },
    {
      label: 'Clear chat',
      detail: 'Remove messages from this device',
      icon: Eraser,
      destructive: true,
      onPress: () => {
        confirm('Clear chat?', `This removes the message history for ${participantName} on this device.`, () => {
          onClearChat();
          onClose();
        });
      }
    }
  );

  if (isGroup) {
    options.push({
      label: 'Leave group',
      detail: `Stop receiving messages from ${participantName}`,
      icon: LogOut,
      destructive: true,
      onPress: () => {
        confirm('Leave group?', `You will no longer receive messages from ${participantName}.`, () => {
          onClose();
          navigation.goBack();
          Alert.alert('Left group', `You left ${participantName}.`);
        });
      }
    });
  } else if (otherUserId) {
    options.push({
      label: 'Block user',
      detail: `Stop ${participantName} from messaging you`,
      icon: Ban,
      destructive: true,
      onPress: () => {
        confirm('Block user?', `${participantName} will not be able to message you.`, () => {
          onClose();
          navigation.goBack();
          Alert.alert('User blocked', `${participantName} has been blocked.`);
        });
      }
    });
  }

  options.push({
    label: isGroup ? 'Report group' : 'Report user',
    detail: 'Flag spam, abuse, or inappropriate content',
    icon: Flag,
    destructive: true,
    onPress: () => {
      confirm('Report chat?', 'Our team will review this conversation.', () => {
        onClose();
        Alert.alert('Report submitted', 'Thanks for helping keep SPORTZ safe.');
      });
    }
  });

  return (
    <BottomSheet open={open} title="Chat options" onClose={onClose}>
      <View>
        {options.map((option) => (
          <Pressable key={option.label} style={styles.option} onPress={option.onPress}>
            <View style={[styles.iconWrap, option.destructive ? styles.iconWrapDanger : null]}>
              <option.icon
                size={20}
                color={option.destructive ? colors.semantic.danger : colors.orange[500]}
                strokeWidth={2.1}
              />
            </View>
            <View style={styles.meta}>
              <AppText style={[styles.label, option.destructive ? styles.labelDanger : null]}>{option.label}</AppText>
              <AppText variant="small">{option.detail}</AppText>
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
  iconWrapDanger: {
    backgroundColor: 'rgba(255, 77, 77, 0.12)'
  },
  meta: {
    flex: 1
  },
  label: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  labelDanger: {
    color: colors.semantic.danger
  }
});
