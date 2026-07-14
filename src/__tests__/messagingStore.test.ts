/**
 * Tests for the Zustand messagingStore, specifically the state that was
 * previously scattered as module-level mutable Maps/Sets in messageService.ts.
 */

import { act } from 'react';
import { useMessagingStore } from '@/store/messagingStore';

// Reset store state between tests
beforeEach(() => {
  useMessagingStore.setState({
    mutedConversations: {},
    readConversationIds: new Set(),
    conversationPreviews: new Map()
  });
});

describe('messagingStore — mute', () => {
  it('toggles a conversation from unmuted to muted', () => {
    act(() => {
      useMessagingStore.getState().toggleMuteConversation('conv-1');
    });
    expect(useMessagingStore.getState().mutedConversations['conv-1']).toBe(true);
  });

  it('toggles a conversation from muted back to unmuted', () => {
    act(() => {
      useMessagingStore.getState().toggleMuteConversation('conv-1');
      useMessagingStore.getState().toggleMuteConversation('conv-1');
    });
    expect(useMessagingStore.getState().mutedConversations['conv-1']).toBe(false);
  });

  it('sets the server-confirmed mute state explicitly', () => {
    act(() => {
      useMessagingStore.getState().setConversationMutedLocally('conv-1', true);
      useMessagingStore.getState().setConversationMutedLocally('conv-2', false);
    });

    expect(useMessagingStore.getState().mutedConversations).toEqual({
      'conv-1': true,
      'conv-2': false
    });
  });
});

describe('messagingStore — readConversationIds', () => {
  it('adds a conversation to the read set', () => {
    act(() => {
      useMessagingStore.getState().markConversationReadLocally('conv-read');
    });
    expect(useMessagingStore.getState().readConversationIds.has('conv-read')).toBe(true);
  });

  it('does not remove other conversations from the read set', () => {
    act(() => {
      useMessagingStore.getState().markConversationReadLocally('conv-a');
      useMessagingStore.getState().markConversationReadLocally('conv-b');
    });
    const { readConversationIds } = useMessagingStore.getState();
    expect(readConversationIds.has('conv-a')).toBe(true);
    expect(readConversationIds.has('conv-b')).toBe(true);
  });
});

describe('messagingStore — conversationPreviews', () => {
  it('stores and retrieves a conversation preview', () => {
    const preview = { lastMessage: 'You: See you there!', lastMessageAt: '2026-06-15T10:00:00.000Z' };

    act(() => {
      useMessagingStore.getState().setConversationPreview('conv-1', preview);
    });

    expect(useMessagingStore.getState().conversationPreviews.get('conv-1')).toEqual(preview);
  });

  it('overrides an existing preview', () => {
    act(() => {
      useMessagingStore.getState().setConversationPreview('conv-1', { lastMessage: 'old', lastMessageAt: '' });
      useMessagingStore.getState().setConversationPreview('conv-1', { lastMessage: 'new', lastMessageAt: '' });
    });
    expect(useMessagingStore.getState().conversationPreviews.get('conv-1')?.lastMessage).toBe('new');
  });

  it('clearConversationPreview resets to "No messages yet"', () => {
    act(() => {
      useMessagingStore.getState().setConversationPreview('conv-1', { lastMessage: 'hey', lastMessageAt: '' });
      useMessagingStore.getState().clearConversationPreview('conv-1');
    });
    expect(useMessagingStore.getState().conversationPreviews.get('conv-1')?.lastMessage).toBe('No messages yet');
  });
});
