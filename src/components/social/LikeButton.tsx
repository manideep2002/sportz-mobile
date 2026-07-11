import { memo } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { Heart } from 'lucide-react-native';

import { AppText } from '@/components/ui';
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
        color={liked ? colors.orange[400] : colors.text.tertiary}
        fill={liked ? colors.orange[400] : 'transparent'}
      />
      <AppText style={[styles.actionText, liked ? styles.actionActive : null, active ? styles.syncing : null]}>
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
  actionActive: {
    color: colors.orange[400]
  },
  syncing: {
    opacity: 0.86
  }
});
