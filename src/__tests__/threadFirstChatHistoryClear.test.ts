const mockParticipantsQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  maybeSingle: jest.fn()
};
const mockMessagesQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  is: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  gt: jest.fn(),
  or: jest.fn(),
  then: jest.fn()
};
let mockSignedInUserId = 'user-a';

for (const method of ['select', 'eq']) {
  (mockParticipantsQuery[method as keyof typeof mockParticipantsQuery] as jest.Mock).mockImplementation(() => mockParticipantsQuery);
}
for (const method of ['select', 'eq', 'is', 'order', 'limit', 'gt', 'or']) {
  (mockMessagesQuery[method as keyof typeof mockMessagesQuery] as jest.Mock).mockImplementation(() => mockMessagesQuery);
}

jest.mock('@/lib/env', () => ({ env: { isSupabaseConfigured: true } }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: { id: mockSignedInUserId } }, error: null })) },
    from: jest.fn((table: string) => table === 'chat_participants' ? mockParticipantsQuery : mockMessagesQuery)
  }
}));

// eslint-disable-next-line import/first
import { isMessageVisibleAfterClear, threadFirstChatService } from '@/services/threadFirstChatService';

const page = [{
  id: 'message-new', room_id: 'room-1', sender_id: 'user-b', message_type: 'text', body: 'new',
  media_url: null, media_path: null, media_width: null, media_height: null, media_mime_type: null,
  created_at: '2026-07-29T10:01:00.000Z', edited_at: null
}];

describe('thread-first history clear pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignedInUserId = 'user-a';
    mockParticipantsQuery.maybeSingle.mockResolvedValue({ data: { cleared_at: '2026-07-29T10:00:00.000Z' }, error: null });
    mockMessagesQuery.then.mockImplementation((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: page, error: null }).then(resolve, reject)
    );
  });

  it('applies the participant watermark to both first and cursor pages', async () => {
    await threadFirstChatService.listMessages('room-1');
    await threadFirstChatService.listMessages('room-1', {
      createdAt: '2026-07-29T10:01:00.000Z',
      id: 'message-new'
    });

    expect(mockMessagesQuery.gt).toHaveBeenCalledWith('created_at', '2026-07-29T10:00:00.000Z');
    expect(mockMessagesQuery.or).toHaveBeenCalledWith(
      'created_at.lt.2026-07-29T10:01:00.000Z,and(created_at.eq.2026-07-29T10:01:00.000Z,id.lt.message-new)'
    );
  });

  it('reads the signed-in participant each time, so a switched account cannot inherit a watermark', async () => {
    await threadFirstChatService.listMessages('room-1');
    mockSignedInUserId = 'user-b';
    mockParticipantsQuery.maybeSingle.mockResolvedValue({ data: { cleared_at: null }, error: null });
    const clearedFilterCalls = mockMessagesQuery.gt.mock.calls.length;

    await threadFirstChatService.listMessages('room-1');

    expect(mockParticipantsQuery.eq).toHaveBeenCalledWith('user_id', 'user-b');
    expect(mockMessagesQuery.gt).toHaveBeenCalledTimes(clearedFilterCalls);
  });

  it('keeps realtime messages at the clear boundary hidden', () => {
    expect(isMessageVisibleAfterClear('2026-07-29T10:00:00.000Z', '2026-07-29T10:00:00.000Z')).toBe(false);
    expect(isMessageVisibleAfterClear('2026-07-29T10:00:00.001Z', '2026-07-29T10:00:00.000Z')).toBe(true);
  });
});
