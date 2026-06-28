/**
 * Verifies that communityService methods throw when Supabase is not configured,
 * matching the behaviour of all other services in the codebase.
 *
 * The supabase module and env module are mocked so this test runs in CI
 * without any real network credentials.
 */

jest.mock('@/lib/supabase', () => ({
  supabase: {}
}));

jest.mock('@/lib/env', () => ({
  env: { isSupabaseConfigured: false }
}));

import { communityService } from '@/services/communityService';

describe('communityService — Supabase guard', () => {
  it('listCommunities throws when Supabase is not configured', async () => {
    await expect(communityService.listCommunities()).rejects.toThrow(/not configured/i);
  });

  it('getCommunity throws when Supabase is not configured', async () => {
    await expect(communityService.getCommunity('some-id')).rejects.toThrow(/not configured/i);
  });
});
