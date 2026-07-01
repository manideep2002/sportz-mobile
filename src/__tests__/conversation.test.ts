import {
  getConversationIdForUser,
  getOtherParticipant,
  sortConversations
} from '@/utils/conversation';
import type { Conversation, UserProfile } from '@/types/domain';

const makeProfile = (id: string, displayName = 'Athlete'): UserProfile => ({
  id,
  username: id,
  displayName,
  initials: displayName.slice(0, 2).toUpperCase(),
  bio: '',
  city: '',
  country: 'IN',
  primarySport: 'Basketball',
  sports: ['Basketball'],
  skillLevel: 'Intermediate',
  isOnline: false,
  badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
});

const makeConversation = (id: string, lastMessageAt: string, participants: UserProfile[] = []): Conversation => ({
  id,
  title: id,
  participants,
  isGroup: false,
  lastMessage: 'hey',
  lastMessageAt,
  unreadCount: 0
});

describe('sortConversations', () => {
  it('sorts most-recently-active conversation first', () => {
    const older = makeConversation('older', '2026-01-01T00:00:00.000Z');
    const newer = makeConversation('newer', '2026-06-01T00:00:00.000Z');

    const sorted = sortConversations([older, newer]);

    expect(sorted[0].id).toBe('newer');
    expect(sorted[1].id).toBe('older');
  });

  it('does not mutate the original array', () => {
    const conversations = [
      makeConversation('a', '2026-01-01T00:00:00.000Z'),
      makeConversation('b', '2026-06-01T00:00:00.000Z')
    ];
    const original = [...conversations];
    sortConversations(conversations);
    expect(conversations).toEqual(original);
  });
});

describe('getOtherParticipant', () => {
  const me = makeProfile('user-me');
  const them = makeProfile('user-them');

  it('returns the other participant in a 1-on-1 conversation', () => {
    const conversation = { ...makeConversation('conv-1', ''), participants: [me, them] };
    expect(getOtherParticipant(conversation, 'user-me')).toBe(them);
  });

  it('returns undefined for group conversations', () => {
    const groupConversation = {
      ...makeConversation('group-1', ''),
      isGroup: true,
      participants: [me, them]
    };
    expect(getOtherParticipant(groupConversation, 'user-me')).toBeUndefined();
  });

  it('returns undefined for malformed direct conversations with extra members', () => {
    const extra = makeProfile('user-extra');
    const conversation = { ...makeConversation('conv-bad', ''), participants: [extra, me, them] };

    expect(getOtherParticipant(conversation, 'user-me')).toBeUndefined();
  });
});

describe('getConversationIdForUser', () => {
  const user = makeProfile('user-target');

  it('finds the direct conversation with a given user', () => {
    const direct = { ...makeConversation('conv-direct', ''), participants: [makeProfile('user-me'), user] };
    const group = { ...makeConversation('conv-group', ''), isGroup: true, participants: [user] };

    expect(getConversationIdForUser([group, direct], 'user-target')).toBe('conv-direct');
  });

  it('returns undefined when no conversation exists for the user', () => {
    expect(getConversationIdForUser([], 'user-target')).toBeUndefined();
  });

  it('ignores malformed direct conversations with extra members', () => {
    const malformed = {
      ...makeConversation('conv-bad', ''),
      participants: [makeProfile('user-me'), user, makeProfile('user-extra')]
    };

    expect(getConversationIdForUser([malformed], 'user-target')).toBeUndefined();
  });
});
