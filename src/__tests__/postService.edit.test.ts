const mockGetUser = jest.fn();
const mockRpc = jest.fn();
const mockUploadReplacement = jest.fn();
const mockRemovePostMedia = jest.fn();
const mockValidateMedia = jest.fn();

let mockOriginalResult: { data: Record<string, unknown> | null; error: { message: string; code?: string } | null };
let mockMentionRows: Record<string, unknown>[] = [];

const emptyResult = () => Promise.resolve({ data: [], error: null });

const mockFrom = jest.fn((table: string) => {
  if (table === 'posts') {
    const postsQuery = {
      select: jest.fn(() => postsQuery),
      eq: jest.fn(() => postsQuery),
      single: jest.fn(() => Promise.resolve(mockOriginalResult))
    };
    return postsQuery;
  }

  if (table === 'post_mentions') {
    const mentionQuery = {
      select: jest.fn(() => mentionQuery),
      eq: jest.fn(() => Promise.resolve({ data: mockMentionRows, error: null }))
    };
    return mentionQuery;
  }

  if (table === 'post_likes' || table === 'saved_posts') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ in: jest.fn(emptyResult) }))
      }))
    };
  }

  if (table === 'post_shares') {
    return {
      select: jest.fn(() => ({ in: jest.fn(emptyResult) }))
    };
  }

  throw new Error(`Unexpected table in test: ${table}`);
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args)
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args)
  }
}));

jest.mock('@/lib/supabaseOnly', () => ({
  assertSupabaseConfigured: jest.fn()
}));

jest.mock('@/services/storageService', () => ({
  storageService: {
    uploadPostMediaResumable: (...args: unknown[]) => mockUploadReplacement(...args),
    removePostMedia: (...args: unknown[]) => mockRemovePostMedia(...args),
    validateMediaAsset: (...args: unknown[]) => mockValidateMedia(...args),
    postMediaObjectNameFromUrl: jest.fn(() => null)
  }
}));

jest.mock('@/services/hotCacheService', () => ({
  hotCacheService: {
    invalidateByPrefix: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('@/services/feedDedupeService', () => ({
  feedDedupeService: {
    keepUnique: (items: unknown[]) => items
  }
}));

// eslint-disable-next-line import/first
import { postService } from '@/services/postService';

const originalRow = {
  id: 'post-1',
  author_id: 'user-1',
  community_id: null,
  kind: 'post',
  sport: 'Basketball',
  body: 'Original',
  media_url: 'https://example.test/old.jpg',
  media_kind: 'image',
  media_storage_path: 'user-1/old.jpg',
  media_width: 800,
  media_height: 600,
  media_processing_status: 'ready',
  stats_line: null,
  visibility: 'public',
  location_label: 'Old court',
  created_at: '2026-07-01T00:00:00.000Z',
  profiles: {
    id: 'user-1',
    display_name: 'Asha Singh',
    username: 'asha'
  }
};

const replacementAsset = {
  uri: 'file:///replacement.mp4',
  width: 1280,
  height: 720,
  assetId: null,
  type: 'video' as const
};

describe('postService.updatePost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockOriginalResult = { data: originalRow, error: null };
    mockMentionRows = [];
    mockRemovePostMedia.mockResolvedValue(undefined);
    mockUploadReplacement.mockResolvedValue({
      bucket: 'post-media',
      objectName: 'user-1/replacement.mp4',
      publicUrl: 'https://example.test/replacement.mp4',
      contentType: 'video/mp4',
      bytesUploaded: 10,
      bytesTotal: 10
    });
    mockRpc.mockImplementation((_name: string, params: Record<string, unknown>) =>
      Promise.resolve({
        data: {
          ...originalRow,
          body: params.target_body,
          media_url: params.target_media_url,
          media_kind: params.target_media_kind,
          media_storage_path: params.target_media_storage_path,
          media_width: params.target_media_width,
          media_height: params.target_media_height,
          location_label: params.target_location_label
        },
        error: null
      })
    );
  });

  it('updates a text-only post without touching storage', async () => {
    const post = await postService.updatePost('post-1', {
      body: 'Updated',
      sport: 'Football',
      locationLabel: 'New court'
    });

    expect(post.body).toBe('Updated');
    expect(post.locationLabel).toBe('New court');
    expect(mockUploadReplacement).not.toHaveBeenCalled();
    expect(mockRemovePostMedia).not.toHaveBeenCalled();
  });

  it('uploads replacement media before persistence and removes old media afterward', async () => {
    const post = await postService.updatePost('post-1', {
      body: 'Mixed media',
      sport: 'Basketball',
      mediaAsset: replacementAsset,
      mediaKind: 'video'
    });

    expect(post.mediaUrl).toBe('https://example.test/replacement.mp4');
    expect(mockUploadReplacement.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]);
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockRemovePostMedia.mock.invocationCallOrder[0]);
    expect(mockRemovePostMedia).toHaveBeenCalledWith('user-1/old.jpg');
  });

  it('removes media only after the database accepts the edit', async () => {
    const post = await postService.updatePost('post-1', {
      body: 'Text remains',
      sport: 'Basketball',
      removeMedia: true
    });

    expect(post.mediaUrl).toBeNull();
    expect(post.mediaKind).toBe('none');
    expect(mockRpc).toHaveBeenCalledWith(
      'update_post_content',
      expect.objectContaining({
        target_media_url: null,
        target_media_storage_path: null
      })
    );
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockRemovePostMedia.mock.invocationCallOrder[0]);
  });

  it('rolls back a staged replacement when persistence fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Rejected' }
    });

    await expect(postService.updatePost('post-1', {
      body: '',
      sport: 'Basketball',
      mediaAsset: replacementAsset,
      mediaKind: 'video'
    })).rejects.toMatchObject({ message: 'Rejected' });

    expect(mockRemovePostMedia).toHaveBeenCalledTimes(1);
    expect(mockRemovePostMedia).toHaveBeenCalledWith('user-1/replacement.mp4');
    expect(mockRemovePostMedia).not.toHaveBeenCalledWith('user-1/old.jpg');
  });

  it('rejects unauthorized updates before upload or mutation', async () => {
    mockOriginalResult = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    };

    await expect(postService.updatePost('post-1', {
      body: 'Tampered',
      sport: 'Basketball',
      mediaAsset: replacementAsset
    })).rejects.toMatchObject({ code: 'PGRST116' });

    expect(mockUploadReplacement).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
