export function getChatPresenceLabel({
  connected,
  synced,
  isGroup,
  typingCount,
  onlinePeerCount
}: {
  connected: boolean;
  synced: boolean;
  isGroup: boolean;
  typingCount: number;
  onlinePeerCount: number;
}) {
  if (connected && typingCount > 0) {
    return typingCount === 1 ? 'User is typing...' : `${typingCount} people are typing...`;
  }
  if (!connected) return 'Presence unavailable';
  if (!synced) return isGroup ? 'Group chat' : 'Chat';
  if (isGroup) return onlinePeerCount > 0 ? `${onlinePeerCount} online` : 'Group chat';
  return onlinePeerCount > 0 ? 'Active now' : 'Offline';
}
