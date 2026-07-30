import { getChatPresenceLabel } from '@/utils/chatPresence';

describe('direct-chat presence label', () => {
  it.each([
    [
      'online',
      { connected: true, synced: true, isGroup: false, typingCount: 0, onlinePeerCount: 1 },
      'Active now'
    ],
    [
      'offline',
      { connected: true, synced: true, isGroup: false, typingCount: 0, onlinePeerCount: 0 },
      'Offline'
    ],
    [
      'unknown before the first presence sync',
      { connected: true, synced: false, isGroup: false, typingCount: 0, onlinePeerCount: 0 },
      'Chat'
    ],
    [
      'typing',
      { connected: true, synced: true, isGroup: false, typingCount: 1, onlinePeerCount: 0 },
      'User is typing...'
    ],
    [
      'disconnected',
      { connected: false, synced: false, isGroup: false, typingCount: 1, onlinePeerCount: 1 },
      'Presence unavailable'
    ]
  ])('represents %s truthfully', (_state, input, expected) => {
    expect(getChatPresenceLabel(input)).toBe(expected);
  });
});
