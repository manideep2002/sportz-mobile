import { useEffect, useState, type RefObject } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';

import { AppText, Avatar, IconButton, Input, VerifiedName } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useCreateComment } from '@/hooks/useFeed';
import type { Comment, UserProfile } from '@/types/domain';

interface CommentInputProps {
  postId: string;
  profile?: UserProfile | null;
  replyingTo?: Comment | null;
  inputRef?: RefObject<TextInput | null>;
  disabled?: boolean;
  onCancelReply?: () => void;
  onSubmitted?: () => void;
}

export function CommentInput({
  postId,
  profile,
  replyingTo,
  inputRef,
  disabled,
  onCancelReply,
  onSubmitted
}: CommentInputProps) {
  const [body, setBody] = useState('');
  const createComment = useCreateComment(postId);
  const trimmedBody = body.trim();

  useEffect(() => {
    if (!replyingTo) return;
    setBody((current) => (current.trim() ? current : `@${replyingTo.author.username} `));
  }, [replyingTo]);

  const submitComment = () => {
    if (!trimmedBody || disabled) return;

    const draft = trimmedBody;
    setBody('');
    createComment.mutate(
      { body: draft, parentCommentId: replyingTo?.id },
      {
        onSuccess: onSubmitted,
        onError: (error) => {
          setBody(draft);
          Alert.alert('Could not comment', error instanceof Error ? error.message : 'Please try again.');
        }
      }
    );
  };

  return (
    <View style={styles.commentInput}>
      <Avatar initials={profile?.initials ?? 'SP'} uri={profile?.avatarUrl} size={36} />
      <View style={styles.inputWrap}>
        {replyingTo ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setBody('');
              onCancelReply?.();
            }}
          >
            <View style={styles.replyingToRow}>
              <AppText variant="small" style={styles.replyingTo}>Replying to</AppText>
              <VerifiedName
                profile={replyingTo.author}
                variant="small"
                style={styles.replyingTo}
                badgeSize={12}
                numberOfLines={1}
              />
            </View>
          </Pressable>
        ) : null}
        <Input
          ref={inputRef}
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment..."
          returnKeyType="send"
          editable={!disabled}
          onSubmitEditing={submitComment}
        />
      </View>
      <IconButton
        icon={Send}
        accessibilityLabel="Send comment"
        filled
        size={40}
        disabled={!trimmedBody || createComment.isPending || disabled}
        accessibilityState={{ disabled: !trimmedBody || createComment.isPending || disabled }}
        onPress={submitComment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginTop: 16
  },
  inputWrap: {
    flex: 1
  },
  replyingTo: {
    color: colors.orange[300],
    marginBottom: 4
  },
  replyingToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginBottom: 4
  }
});
