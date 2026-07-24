import { memo } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { Heart } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors } from '@/design/tokens';
import { useOptimisticPostLike } from '@/hooks/useFeed';

interface LikeButtonProps {
  postId: string;
  liked: boolean;
  count: number;
  disabled?: boolean;
  stopPropagation?: boolean;
}

function LikeButtonComponent({ postId, liked, count, disabled, stopPropagation = true }: LikeButtonProps) {
  const { colors: theme } = useAppTheme();
  const likeMutation = useOptimisticPostLike();
  const active = liked || likeMutation.isPending;

  const handlePress = (event: GestureResponderEvent) => {
    if (stopPropagation) event.stopPropagation();
    if (disabled) return;

    likeMutation.mutate({ postId, liked });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
      accessibilityState={{ selected: liked, disabled }}
      disabled={disabled}
      style={styles.action}
      onPress={handlePress}
    >
      <Heart
        size={22}
        color={liked ? theme.accent : theme.textSubtle}
        fill={liked ? theme.accent : 'transparent'}
      />
      <AppText style={[styles.actionText, { color: liked ? theme.accent : theme.textSubtle }, active ? styles.syncing : null]}>
        {count}
      </AppText>
    </Pressable>
  );
}

export const LikeButton = memo(LikeButtonComponent);

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    justifyContent: 'center'
  },
  actionText: {
    color: colors.text.tertiary,
    fontSize: 13
  },
  syncing: {
    opacity: 0.86
  }
});
