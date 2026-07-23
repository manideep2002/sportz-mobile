const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockUploadProfileCover = jest.fn();
const mockRemoveProfileCover = jest.fn();
const mockResolveProfileCoverUrl = jest.fn();
const mockProfileCoverObjectFromValue = jest.fn();
const mockInvalidate = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args)
    },
    from: (...args: unknown[]) => mockFrom(...args)
  }
}));

jest.mock('@/lib/supabaseOnly', () => ({
  assertSupabaseConfigured: jest.fn()
}));

jest.mock('@/services/storageService', () => ({
  storageService: {
    uploadProfileCover: (...args: unknown[]) => mockUploadProfileCover(...args),
    removeProfileCover: (...args: unknown[]) => mockRemoveProfileCover(...args),
    resolveProfileCoverUrl: (...args: unknown[]) => mockResolveProfileCoverUrl(...args),
    profileCoverObjectFromValue: (...args: unknown[]) => mockProfileCoverObjectFromValue(...args)
  }
}));

jest.mock('@/services/hotCacheService', () => ({
  hotCacheService: {
    invalidate: (...args: unknown[]) => mockInvalidate(...args),
    getOrSet: (_key: string, loader: () => Promise<unknown>) => loader()
  }
}));

// eslint-disable-next-line import/first
import { profileService } from '@/services/profileService';

const originalRow = {
  id: 'user-1',
  username: 'asha',
  display_name: 'Asha Singh',
  bio: 'Guard',
  city: 'Pune',
  country: 'IN',
  primary_sport: 'Cricket',
  sports: ['Cricket', 'Running', 'Swimming'],
  cover_url: 'user-1/old.jpg',
  skill_level: 'Advanced',
  is_private: false,
  followers_count: 4,
  following_count: 2,
  posts_count: 3
};

let updateError: { message: string; code?: string } | null;
let updateValues: Record<string, unknown>;
let currentOriginalRow: typeof originalRow;

const configureProfileQueries = () => {
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);

    const root = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: currentOriginalRow, error: null }))
        }))
      })),
      update: jest.fn((values: Record<string, unknown>) => {
        updateValues = values;
        return {
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: updateError ? null : { ...currentOriginalRow, ...values },
                  error: updateError
                })
              )
            }))
          }))
        };
      })
    };
    return root;
  });
};

describe('profileService.updateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateError = null;
    updateValues = {};
    currentOriginalRow = originalRow;
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockUploadProfileCover.mockResolvedValue('user-1/new.jpg');
    mockRemoveProfileCover.mockResolvedValue(undefined);
    mockResolveProfileCoverUrl.mockImplementation((value: string | null) =>
      Promise.resolve(value ? `signed:${value}` : null)
    );
    mockProfileCoverObjectFromValue.mockReturnValue({
      bucket: 'profile-covers',
      objectName: 'user-1/old.jpg'
    });
    mockInvalidate.mockResolvedValue(undefined);
    configureProfileQueries();
  });

  it('preserves secondary sports when editing name and bio', async () => {
    const profile = await profileService.updateProfile('user-1', {
      displayName: 'Asha S.',
      bio: 'Captain'
    });

    expect(updateValues).toMatchObject({
      display_name: 'Asha S.',
      bio: 'Captain',
      primary_sport: 'Cricket',
      sports: ['Cricket', 'Running', 'Swimming']
    });
    expect(profile.sports).toEqual(['Cricket', 'Running', 'Swimming']);
  });

  it('keeps selected secondary sports when the primary sport changes', async () => {
    await profileService.updateProfile('user-1', {
      primarySport: 'Football'
    });

    expect(updateValues).toMatchObject({
      primary_sport: 'Football',
      sports: ['Football', 'Cricket', 'Running', 'Swimming']
    });
  });

  it('uploads a replacement before persistence and removes the old cover afterward', async () => {
    const asset = {
      uri: 'file:///cover.jpg',
      width: 1200,
      height: 600,
      assetId: null,
      type: 'image' as const
    };

    const profile = await profileService.updateProfile('user-1', { coverAsset: asset });

    expect(updateValues.cover_url).toBe('user-1/new.jpg');
    expect(mockUploadProfileCover.mock.invocationCallOrder[0]).toBeLessThan(
      mockFrom.mock.results[1].value.update.mock.invocationCallOrder[0]
    );
    expect(mockRemoveProfileCover).toHaveBeenCalledWith('user-1/old.jpg');
    expect(profile.coverUrl).toBe('signed:user-1/new.jpg');
  });

  it('removes a cover and leaves the profile on the gradient fallback', async () => {
    const profile = await profileService.updateProfile('user-1', { removeCover: true });

    expect(updateValues.cover_url).toBeNull();
    expect(mockRemoveProfileCover).toHaveBeenCalledWith('user-1/old.jpg');
    expect(profile.coverUrl).toBeNull();
  });

  it('removes a legacy public cover when the profile becomes private', async () => {
    currentOriginalRow = {
      ...originalRow,
      cover_url: 'https://example.test/storage/v1/object/public/post-media/user-1/legacy.jpg'
    };
    mockProfileCoverObjectFromValue.mockReturnValue({
      bucket: 'post-media',
      objectName: 'user-1/legacy.jpg'
    });

    const profile = await profileService.updateProfile('user-1', { isPrivate: true });

    expect(updateValues).toMatchObject({ is_private: true, cover_url: null });
    expect(mockRemoveProfileCover).toHaveBeenCalledWith(currentOriginalRow.cover_url);
    expect(profile.coverUrl).toBeNull();
  });

  it('deletes a staged upload and preserves the old cover when persistence fails', async () => {
    updateError = { code: '42501', message: 'Rejected' };
    const asset = {
      uri: 'file:///cover.jpg',
      width: 1200,
      height: 600,
      assetId: null,
      type: 'image' as const
    };

    await expect(
      profileService.updateProfile('user-1', { coverAsset: asset })
    ).rejects.toMatchObject({ message: 'Rejected' });

    expect(mockRemoveProfileCover).toHaveBeenCalledTimes(1);
    expect(mockRemoveProfileCover).toHaveBeenCalledWith('user-1/new.jpg');
    expect(mockRemoveProfileCover).not.toHaveBeenCalledWith('user-1/old.jpg');
  });

  it('rejects unauthorized updates before reading, uploading, or mutating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'attacker' } }, error: null });

    await expect(
      profileService.updateProfile('user-1', {
        coverAsset: {
          uri: 'file:///cover.jpg',
          width: 1200,
          height: 600,
          assetId: null,
          type: 'image'
        }
      })
    ).rejects.toThrow('You can only update your own profile.');

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUploadProfileCover).not.toHaveBeenCalled();
  });
});

describe('profile cover privacy hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileCoverObjectFromValue.mockReturnValue({
      bucket: 'post-media',
      objectName: 'user-1/legacy.jpg'
    });
    mockResolveProfileCoverUrl.mockResolvedValue('public legacy URL');
    mockFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: {
                ...originalRow,
                is_private: true,
                cover_url: 'https://example.test/storage/v1/object/public/post-media/user-1/legacy.jpg'
              },
              error: null
            })
          )
        }))
      }))
    });
  });

  it('does not expose a legacy public cover for a private profile', async () => {
    const profile = await profileService.getProfile('user-1');

    expect(profile.coverUrl).toBeNull();
    expect(mockResolveProfileCoverUrl).not.toHaveBeenCalled();
  });
});
