import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ThreadFirstChatScreen } from '@/screens/messages/ThreadFirstChatScreen';
import { useConversation } from '@/hooks/useMessages';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { getOtherParticipant, getParticipantById } from '@/utils/conversation';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Chat'>;

export function ChatScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const roomId = route.params.conversationId;
  const targetUserId = route.params.targetUserId;
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const { data: conversation } = useConversation(roomId);

  const directParticipant =
    conversation && targetUserId
      ? getParticipantById(conversation, targetUserId) ?? getOtherParticipant(conversation, currentUserId)
      : conversation
        ? getOtherParticipant(conversation, currentUserId)
        : undefined;
  const title = conversation?.isGroup
    ? conversation.title
    : directParticipant?.displayName ?? conversation?.title ?? 'Chat';

  return (
    <ThreadFirstChatScreen
      roomId={roomId}
      title={title}
      onBack={() => navigation.goBack()}
    />
  );
}
