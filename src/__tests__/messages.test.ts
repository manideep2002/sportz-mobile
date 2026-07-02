import {
  applyConversationPreview,
  buildConversationPreview,
  formatConversationPreview,
  mergeConfirmedMessage
} from '@/utils/messages';
import type { Conversation, Message } from '@/types/domain';

const makeConversation = (id: string, overrides: Partial<Conversation> = {}): Conversation => ({
  id,
  title: id,
  participants: [],
  isGroup: false,
  lastMessage: '',
  lastMessageAt: '2026-01-01T00:00:00.000Z',
  unreadCount: 0,
  ...overrides
});

describe('formatConversationPreview', () => {
  it('prefixes message with "You: " when the sender is the current user', () => {
    expect(formatConversationPreview('Hello!', 'user-me', 'user-me')).toBe('You: Hello!');
  });

  it('returns the raw body when the sender is another user', () => {
    expect(formatConversationPreview('Hello!', 'user-them', 'user-me')).toBe('Hello!');
  });
});

describe('buildConversationPreview', () => {
  it('builds a preview object from a message', () => {
    const message = {
      body: 'Ready to play?',
      senderId: 'user-arjun',
      createdAt: '2026-06-15T10:00:00.000Z'
    };

    const preview = buildConversationPreview(message, 'user-marcus');

    expect(preview.lastMessage).toBe('Ready to play?');
    expect(preview.lastMessageAt).toBe('2026-06-15T10:00:00.000Z');
  });

  it('prefixes with "You: " when the sender is the viewer', () => {
    const message = { body: 'On my way', senderId: 'user-me', createdAt: '' };
    const preview = buildConversationPreview(message, 'user-me');
    expect(preview.lastMessage).toBe('You: On my way');
  });
});

describe('applyConversationPreview', () => {
  it('merges the preview into the matching conversation and re-sorts', () => {
    const older = makeConversation('conv-older', { lastMessageAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeConversation('conv-newer', { lastMessageAt: '2026-03-01T00:00:00.000Z' });
    const preview = { lastMessage: 'Updated!', lastMessageAt: '2026-06-01T00:00:00.000Z' };

    const result = applyConversationPreview([older, newer], 'conv-older', preview);

    // conv-older now has a more recent timestamp, so it should sort first.
    expect(result[0].id).toBe('conv-older');
    expect(result[0].lastMessage).toBe('Updated!');
    expect(result[0].lastMessageAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('leaves other conversations unchanged', () => {
    const a = makeConversation('a', { lastMessage: 'old' });
    const b = makeConversation('b', { lastMessage: 'keep me' });
    const preview = { lastMessage: 'new', lastMessageAt: '2026-06-01T00:00:00.000Z' };

    const result = applyConversationPreview([a, b], 'a', preview);
    const bResult = result.find((c) => c.id === 'b');

    expect(bResult?.lastMessage).toBe('keep me');
  });
});

describe('mergeConfirmedMessage', () => {
  const confirmed: Message = {
    id: 'server-1',
    conversationId: 'conv-1',
    senderId: 'user-me',
    body: 'Hello',
    createdAt: '2026-07-01T10:00:00.000Z',
    readBy: ['user-me']
  };

  it('replaces the optimistic message with the confirmed server message', () => {
    const optimistic: Message = { ...confirmed, id: 'optimistic-1', pending: true };

    expect(mergeConfirmedMessage([optimistic], optimistic.id, confirmed)).toEqual([confirmed]);
  });

  it('dedupes a realtime message that arrived before mutation success', () => {
    const optimistic: Message = { ...confirmed, id: 'optimistic-1', pending: true };

    expect(mergeConfirmedMessage([optimistic, confirmed], optimistic.id, confirmed)).toEqual([confirmed]);
  });
});
