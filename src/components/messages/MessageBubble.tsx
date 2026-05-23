import { Check, CheckCheck, Clock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import { colors, radii, spacing } from '@/design/tokens';
import type { Message, UserProfile } from '@/types/domain';
import { formatTime } from '@/utils/format';
import { getMessageReadStatus, type MessageReadStatus } from '@/utils/messages';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  recipientId: string;
  sender?: UserProfile;
}

function ReadReceipt({ status }: { status: MessageReadStatus }) {
  if (status === 'pending') {
    return <Clock size={12} color={colors.text.tertiary} strokeWidth={2} />;
  }

  if (status === 'read') {
    return <CheckCheck size={14} color={colors.semantic.success} strokeWidth={2.2} />;
  }

  return <Check size={14} color={colors.text.tertiary} strokeWidth={2.2} />;
}

export function MessageBubble({ message, currentUserId, recipientId, sender }: MessageBubbleProps) {
  const mine = message.senderId === currentUserId;
  const readStatus = mine ? getMessageReadStatus(message, currentUserId, recipientId) : null;

  return (
    <View style={[styles.row, mine ? styles.mineRow : null]}>
      {!mine && sender ? <Avatar initials={sender.initials} size={32} /> : null}
      <View style={[styles.column, mine ? styles.mineColumn : null]}>
        <View style={[styles.bubble, mine ? styles.mine : styles.them]}>
          <AppText style={[styles.text, mine ? styles.mineText : null]}>{message.body}</AppText>
        </View>
        {mine ? (
          <View style={styles.meta}>
            <AppText style={styles.metaTime}>{formatTime(message.createdAt)}</AppText>
            {recipientId ? <ReadReceipt status={readStatus ?? 'sent'} /> : null}
          </View>
        ) : null}
      </View>
    </View>
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
  }
});
