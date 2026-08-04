const mockGetUser = jest.fn();
const mockRpc = jest.fn();
const mockUploadMedia = jest.fn();
const mockRemoveEventCover = jest.fn();
const mockCaptureUnexpectedError = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args)
  }
}));

jest.mock('@/lib/env', () => ({ env: { isSupabaseConfigured: true } }));

jest.mock('@/services/storageService', () => ({
  storageService: {
    uploadMedia: (...args: unknown[]) => mockUploadMedia(...args),
    removeEventCover: (...args: unknown[]) => mockRemoveEventCover(...args)
  }
}));

jest.mock('@/lib/monitoring', () => ({
  captureUnexpectedError: (...args: unknown[]) => mockCaptureUnexpectedError(...args)
}));

// eslint-disable-next-line import/first
import { eventService, type CreateEventInput } from '@/services/eventService';

const mappedEvent = { id: 'event-1' } as never;

const baseInput: CreateEventInput = {
  title: 'Weekend Match',
  eventType: 'Friendly',
  sport: 'Cricket',
  description: 'Friendly match',
  startsAt: '2026-08-10T10:00:00.000Z',
  endsAt: '2026-08-10T12:00:00.000Z',
  locationName: 'Central Park',
  city: 'Mumbai',
  maxPlayers: 11,
  entryFeeCents: 0,
  visibility: 'public'
};

interface MockRpcBuilder {
  data?: unknown;
  error?: Error | null;
  abortSignal: jest.Mock;
}

function makeBuilder(result: { data?: unknown; error?: Error | null }): MockRpcBuilder {
  let builder: MockRpcBuilder;
  builder = { ...result, abortSignal: jest.fn() };
  builder.abortSignal.mockReturnValue(builder);
  return builder;
}

function mockRpcResult(result: { data?: unknown; error?: Error | null }): MockRpcBuilder {
  const builder = makeBuilder(result);
  mockRpc.mockReturnValue(builder);
  return builder;
}

describe('eventService.createEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'organizer-1' } }, error: null });
    jest.spyOn(eventService, 'getEvent').mockResolvedValue(mappedEvent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads a cover, attaches it, and leaves the object in place on success', async () => {
    mockRpcResult({ data: 'event-1', error: null });
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).resolves.toBe(mappedEvent);

    expect(mockUploadMedia).toHaveBeenCalledWith('file:///cover.jpg', 'event-covers', 'organizer-1');
    expect(mockRpc).toHaveBeenCalledWith(
      'create_sport_event',
      expect.objectContaining({ target_cover_url: 'https://storage.test/event-covers/cover.jpg' })
    );
    expect(mockRemoveEventCover).not.toHaveBeenCalled();
  });

  it('creates an event without a cover and never touches storage cleanup', async () => {
    mockRpcResult({ data: 'event-1', error: null });

    await expect(eventService.createEvent(baseInput)).resolves.toBe(mappedEvent);

    expect(mockUploadMedia).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith(
      'create_sport_event',
      expect.objectContaining({ target_cover_url: null })
    );
    expect(mockRemoveEventCover).not.toHaveBeenCalled();
  });

  it('deletes the uploaded cover when the create RPC fails, preserving the original error', async () => {
    const databaseError = new Error('create_sport_event failed');
    mockRpcResult({ data: null, error: databaseError });
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).rejects.toThrow('create_sport_event failed');

    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/event-covers/cover.jpg');
    expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
  });

  it('deletes the uploaded cover when the RPC returns no event id', async () => {
    mockRpcResult({ data: null, error: null });
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).rejects.toThrow('Event was not created.');

    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/event-covers/cover.jpg');
  });

  it('propagates an aborted request and still deletes the uploaded cover', async () => {
    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';
    const builder = mockRpcResult({ data: null, error: abortError });
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');
    const controller = new AbortController();

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' }, controller.signal)
    ).rejects.toThrow('The user aborted a request.');

    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/event-covers/cover.jpg');
  });

  it('recovers on retry after a failed creation cleaned up the first cover', async () => {
    mockRpc
      .mockReturnValueOnce(makeBuilder({ data: null, error: new Error('temporary failure') }))
      .mockReturnValueOnce(makeBuilder({ data: 'event-2', error: null }));
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).rejects.toThrow('temporary failure');
    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).resolves.toBe(mappedEvent);

    expect(mockRemoveEventCover).toHaveBeenCalledTimes(1);
    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/event-covers/cover.jpg');
  });

  it('keeps the original error and reports a failed cleanup to monitoring', async () => {
    mockRpcResult({ data: null, error: new Error('create_sport_event failed') });
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');
    mockRemoveEventCover.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).rejects.toThrow('create_sport_event failed');

    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/event-covers/cover.jpg');
    expect(mockCaptureUnexpectedError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: 'event.coverCleanup',
        extra: { coverUrl: 'https://storage.test/event-covers/cover.jpg' }
      })
    );
  });

  it('does not delete the cover when the event was created but only the follow-up fetch fails', async () => {
    mockRpcResult({ data: 'event-1', error: null });
    mockUploadMedia.mockResolvedValue('https://storage.test/event-covers/cover.jpg');
    jest.spyOn(eventService, 'getEvent').mockRejectedValue(new Error('network down'));

    await expect(
      eventService.createEvent({ ...baseInput, coverImageUri: 'file:///cover.jpg' })
    ).rejects.toThrow('network down');

    expect(mockRemoveEventCover).not.toHaveBeenCalled();
  });
});
