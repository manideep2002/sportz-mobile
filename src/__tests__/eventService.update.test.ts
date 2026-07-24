const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockUploadMedia = jest.fn();
const mockRemoveEventCover = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args)
  }
}));

jest.mock('@/lib/env', () => ({ env: { isSupabaseConfigured: true } }));

jest.mock('@/services/storageService', () => ({
  storageService: {
    uploadMedia: (...args: unknown[]) => mockUploadMedia(...args),
    removeEventCover: (...args: unknown[]) => mockRemoveEventCover(...args)
  }
}));

// eslint-disable-next-line import/first
import { eventService } from '@/services/eventService';

const mappedEvent = { id: 'event-1' } as never;

describe('eventService.updateEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'organizer-1' } }, error: null });
    jest.spyOn(eventService, 'getEvent').mockResolvedValue(mappedEvent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockExistingCover = (coverUrl: string | null) => {
    const single = jest.fn().mockResolvedValue({ data: { cover_url: coverUrl }, error: null });
    const eq = jest.fn().mockReturnValue({ single });
    return { select: jest.fn().mockReturnValue({ eq }) };
  };

  const mockUpdate = (error: Error | null = null) => {
    const single = jest.fn().mockResolvedValue({ data: error ? null : { id: 'event-1' }, error });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    return { update: jest.fn().mockReturnValue({ eq }) };
  };

  it('uploads a replacement before persistence and removes the old object only after success', async () => {
    const updateQuery = mockUpdate();
    mockFrom
      .mockReturnValueOnce(mockExistingCover('https://storage.test/old-cover.jpg'))
      .mockReturnValueOnce(updateQuery);
    mockUploadMedia.mockResolvedValue('https://storage.test/new-cover.jpg');

    await expect(eventService.updateEvent('event-1', { coverImageUri: 'file:///new.jpg' })).resolves.toBe(mappedEvent);

    expect(mockUploadMedia).toHaveBeenCalledWith('file:///new.jpg', 'event-covers', 'organizer-1');
    expect(updateQuery.update).toHaveBeenCalledWith({ cover_url: 'https://storage.test/new-cover.jpg' });
    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/old-cover.jpg');
  });

  it('rolls back a newly uploaded cover when the database update fails', async () => {
    const databaseError = new Error('RLS denied');
    const updateQuery = mockUpdate(databaseError);
    mockFrom
      .mockReturnValueOnce(mockExistingCover('https://storage.test/old-cover.jpg'))
      .mockReturnValueOnce(updateQuery);
    mockUploadMedia.mockResolvedValue('https://storage.test/new-cover.jpg');

    await expect(eventService.updateEvent('event-1', { coverImageUri: 'file:///new.jpg' })).rejects.toThrow('RLS denied');

    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/new-cover.jpg');
    expect(mockRemoveEventCover).not.toHaveBeenCalledWith('https://storage.test/old-cover.jpg');
  });

  it('persists explicit cover removal without deleting the original until the update succeeds', async () => {
    const updateQuery = mockUpdate();
    mockFrom
      .mockReturnValueOnce(mockExistingCover('https://storage.test/old-cover.jpg'))
      .mockReturnValueOnce(updateQuery);

    await eventService.updateEvent('event-1', { coverImageUri: null });

    expect(updateQuery.update).toHaveBeenCalledWith({ cover_url: null });
    expect(mockRemoveEventCover).toHaveBeenCalledWith('https://storage.test/old-cover.jpg');
  });

  it('rejects an RLS-filtered update instead of reporting a false success', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ select }) });
    mockFrom
      .mockReturnValueOnce(mockExistingCover(null))
      .mockReturnValueOnce({ update });

    await expect(eventService.updateEvent('event-1', { title: 'No access' })).rejects.toThrow(
      'You are not authorized to update this event.'
    );
  });
});
