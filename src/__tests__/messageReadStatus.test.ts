import { getMessageReadStatus } from '@/utils/messages';
import type { Message } from '@/types/domain';

const baseMessage: Message = {
  id: 'message-1',
  conversationId: 'conversation-arjun',
  senderId: 'user-marcus',
  body: 'Hello',
  createdAt: new Date().toISOString(),
  readBy: ['user-marcus']
};

describe('getMessageReadStatus', () => {
  it('returns pending while the message is still sending', () => {
    expect(getMessageReadStatus({ ...baseMessage, pending: true }, 'user-marcus', 'user-arjun')).toBe('pending');
  });

  it('returns sent when only the sender has read the message', () => {
    expect(getMessageReadStatus(baseMessage, 'user-marcus', 'user-arjun')).toBe('sent');
  });

  it('returns read when the recipient has a read receipt', () => {
    expect(
      getMessageReadStatus({ ...baseMessage, readBy: ['user-marcus', 'user-arjun'] }, 'user-marcus', 'user-arjun')
    ).toBe('read');
  });
});
