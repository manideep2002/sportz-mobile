import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, Edit3, Flag, Share2, Trash2, UserRound, type LucideIcon } from 'lucide-react-native';

import { AppText, BottomSheet } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { Post } from '@/types/domain';

interface PostOptionsSheetProps {
  open: boolean;
  post: Post | null | undefined;
  currentUserId?: string;
  onClose: () => void;
  onViewAuthor: () => void;
  onSaveToggle: () => void;
  onViewSavedPosts: () => void;
  onShare: () => void;
  onReport: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}

interface PostOption {
  label: string;
  detail: string;
  icon: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
}

export function PostOptionsSheet({
  open,
  post,
  currentUserId,
  onClose,
  onViewAuthor,
  onSaveToggle,
  onViewSavedPosts,
  onShare,
  onReport,
  onEdit,
  onDelete
}: PostOptionsSheetProps) {
  if (!post) {
    return null;
  }

  const isOwnPost = post.author.id === currentUserId;

  const options: PostOption[] = [
    {
      label: post.author.id.startsWith('page-') ? 'View page' : 'View athlete',
      detail: post.author.id.startsWith('page-') ? 'See page details and updates' : 'See athlete profile and stats',
      icon: UserRound,
      onPress: () => {
        onClose();
        onViewAuthor();
      }
    },
    {
      label: post.savedByMe ? 'Unsave' : 'Save',
      detail: post.savedByMe ? 'Remove from saved posts' : 'Save post for later reference',
      icon: Bookmark,
      onPress: () => {
        onClose();
        onSaveToggle();
      }
    },
    {
      label: 'View Saved Posts',
      detail: 'View all your saved posts',
      icon: Bookmark,
      onPress: () => {
        onClose();
        onViewSavedPosts();
      }
    },
    {
      label: 'Share',
      detail: 'Share this post with others',
      icon: Share2,
      onPress: () => {
        onClose();
        onShare();
      }
    },
    {
      label: 'Report Post',
      detail: 'Flag spam, abuse, or inappropriate content',
      icon: Flag,
      onPress: () => {
        onClose();
        onReport();
      }
    }
  ];

  if (isOwnPost) {
    options.push({
      label: 'Edit',
      detail: 'Update post text, sport, visibility, or stat line',
      icon: Edit3,
      onPress: () => {
        onClose();
        onEdit?.();
      }
    });

    options.push({
      label: 'Delete',
      detail: 'Permanently delete this post',
      icon: Trash2,
      destructive: true,
      onPress: () => {
        onClose();
        Alert.alert(
          'Delete Post',
          'Are you sure you want to delete this post? This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: onDelete
            }
          ],
          { cancelable: true }
        );
      }
    });
  }

  return (
    <BottomSheet open={open} title="Post options" onClose={onClose}>
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
              <AppText style={[styles.label, option.destructive ? styles.labelDanger : null]}>
                {option.label}
              </AppText>
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
