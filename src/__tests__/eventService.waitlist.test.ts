const mockGetUser = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args)
  }
}));

jest.mock('@/lib/env', () => ({
  env: { isSupabaseConfigured: true }
}));

// eslint-disable-next-line import/first
import { eventService } from '@/services/eventService';

describe('eventService waitlist lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'viewer-id' } }, error: null });
  });

  it.each([
    ['going', 'going'],
    ['waitlisted', 'waitlisted'],
    ['unexpected', 'going']
  ] as const)('maps join result %s to %s', async (databaseResult, expected) => {
    mockRpc.mockResolvedValue({ data: databaseResult, error: null });

    await expect(eventService.joinEvent('event-1')).resolves.toBe(expected);
    expect(mockRpc).toHaveBeenCalledWith('join_sport_event', { target_event_id: 'event-1' });
  });

  it('leaves an active waitlist through the lifecycle RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await eventService.leaveEventWaitlist('event-1');

    expect(mockRpc).toHaveBeenCalledWith('leave_event_waitlist', { target_event_id: 'event-1' });
  });

  it('reads waitlisted participation through the unified API', async () => {
    mockRpc.mockResolvedValue({ data: 'waitlisted', error: null });

    await expect(eventService.checkUserParticipation('event-1')).resolves.toBe('waitlisted');
    expect(mockRpc).toHaveBeenCalledWith('get_event_participation_status', {
      target_event_id: 'event-1'
    });
  });

  it('returns none for an invalid participation response', async () => {
    mockRpc.mockResolvedValue({ data: 'waiting', error: null });

    await expect(eventService.checkUserParticipation('event-1')).resolves.toBe('none');
  });

  it('returns serializable batch statuses and fills omitted events with none', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { event_id: 'event-1', participation_status: 'going' },
        { event_id: 'event-2', participation_status: 'waitlisted' }
      ],
      error: null
    });

    await expect(
      eventService.checkUserParticipationBatch(['event-1', 'event-2', 'event-3', 'event-1'])
    ).resolves.toEqual({
      'event-1': 'going',
      'event-2': 'waitlisted',
      'event-3': 'none'
    });
    expect(mockRpc).toHaveBeenCalledWith('get_event_participation_statuses', {
      target_event_ids: ['event-1', 'event-2', 'event-3']
    });
  });

  it('uses database-enforced organizer waitlist operations', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await eventService.promoteWaitlistUser('event-1', 'user-2');
    await eventService.removeWaitlistUser('event-1', 'user-3');

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'promote_event_waitlist_user', {
      target_event_id: 'event-1',
      target_user_id: 'user-2'
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'remove_event_waitlist_user', {
      target_event_id: 'event-1',
      target_user_id: 'user-3'
    });
  });

  it('routes RSVP writes through the locked RPC rather than direct table writes', async () => {
    mockRpc.mockResolvedValue({ data: 'interested', error: null });

    await eventService.rsvpEvent('event-1', 'interested');

    expect(mockRpc).toHaveBeenCalledWith('set_sport_event_rsvp', {
      target_event_id: 'event-1',
      target_status: 'interested'
    });
  });
});
