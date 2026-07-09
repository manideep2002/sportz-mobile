import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react-native';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, MediaViewerModal } from '@/components/ui';
import { colors, radii, spacing } from '@/design/tokens';
import type { Message, UserProfile } from '@/types/domain';
import { formatTime } from '@/utils/format';
import { mediaVariants } from '@/utils/mediaOptimization';
import { getMessageReadStatus, type MessageReadStatus } from '@/utils/messages';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  recipientId: string;
  sender?: UserProfile;
  onLongPress?: () => void;
}

function ReadReceipt({ status }: { status: MessageReadStatus }) {
  const label = status === 'pending' ? 'Sending' : status === 'read' ? 'Read' : 'Sent';

  if (status === 'pending') {
    return (
      <View style={styles.receipt}>
        <Clock size={12} color={colors.text.tertiary} strokeWidth={2} />
        <AppText style={styles.receiptText}>{label}</AppText>
      </View>
    );
  }

  if (status === 'read') {
    return (
      <View style={styles.receipt}>
        <CheckCheck size={14} color={colors.semantic.success} strokeWidth={2.2} />
        <AppText style={[styles.receiptText, styles.readReceiptText]}>{label}</AppText>
      </View>
    );
  }

  return (
    <View style={styles.receipt}>
      <Check size={14} color={colors.text.tertiary} strokeWidth={2.2} />
      <AppText style={styles.receiptText}>{label}</AppText>
    </View>
  );
}

export function MessageBubble({ message, currentUserId, recipientId, sender, onLongPress }: MessageBubbleProps) {
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [useRawMedia, setUseRawMedia] = useState(false);
  const mine = message.senderId === currentUserId;
  const readStatus = mine ? getMessageReadStatus(message, currentUserId, recipientId) : null;
  const mediaUrl = message.body.match(/^\[media:(.+)\]$/)?.[1];
  const optimizedMediaUrl = mediaVariants.messageImage(mediaUrl);
  const imageUri = useRawMedia ? mediaUrl : optimizedMediaUrl ?? mediaUrl;
  const location = message.body.match(/^\[location:([-\d.]+),([-\d.]+)\]$/);

  useEffect(() => {
    setUseRawMedia(false);
  }, [mediaUrl]);

  return (
    <>
      <View style={[styles.row, mine ? styles.mineRow : null]}>
        {!mine && sender ? <Avatar initials={sender.initials} uri={sender.avatarUrl} size={32} /> : null}
        <View style={[styles.column, mine ? styles.mineColumn : null]}>
          <Pressable style={[styles.bubble, mine ? styles.mine : styles.them]} onLongPress={onLongPress}>
            {mediaUrl ? (
              <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open image" onPress={() => setMediaViewerOpen(true)}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.media}
                  onError={() => {
                    if (!useRawMedia && optimizedMediaUrl !== mediaUrl) {
                      setUseRawMedia(true);
                    }
                  }}
                />
              </Pressable>
            ) : location ? (
              <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location[1]},${location[2]}`)}>
                <AppText style={[styles.text, mine ? styles.mineText : null]}>View shared location</AppText>
              </Pressable>
            ) : (
              <AppText style={[styles.text, mine ? styles.mineText : null]}>{message.body}</AppText>
            )}
          </Pressable>
          {mine ? (
            <View style={styles.meta}>
              <AppText style={styles.metaTime}>{formatTime(message.createdAt)}</AppText>
              {recipientId ? <ReadReceipt status={readStatus ?? 'sent'} /> : null}
            </View>
          ) : null}
        </View>
      </View>
      <MediaViewerModal visible={mediaViewerOpen} uri={mediaUrl} onClose={() => setMediaViewerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen
  },
  mineRow: {
    justifyContent: 'flex-end'
  },
  column: {
    maxWidth: '74%'
  },
  mineColumn: {
    alignItems: 'flex-end'
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.xl
  },
  mine: {
    backgroundColor: colors.orange[500],
    borderBottomRightRadius: 4
  },
  them: {
    backgroundColor: colors.dark[800],
    borderBottomLeftRadius: 4
  },
  text: {
    color: colors.text.primary,
    fontSize: 13,
    lineHeight: 19
  },
  media: {
    width: 190,
    height: 150,
    borderRadius: radii.md
  },
  mineText: {
    color: colors.light[0]
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingRight: 2
  },
  metaTime: {
    color: colors.text.tertiary,
    fontSize: 10,
    lineHeight: 12
  },
  receipt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  receiptText: {
    color: colors.text.tertiary,
    fontSize: 10,
    lineHeight: 12
  },
  readReceiptText: {
    color: colors.semantic.success
  }
});
