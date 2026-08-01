import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRemoveMember = jest.fn();

jest.mock('@/services/communityService', () => ({
  communityService: { removeMember: (...args: unknown[]) => mockRemoveMember(...args) }
}));

// eslint-disable-next-line import/first
import { communityKeys, useRemoveCommunityMember } from '@/hooks/useCommunities';

const communityId = 'community-1';
const members = [
  { userId: 'owner-1', role: 'owner' },
  { userId: 'member-1', role: 'member' }
];

describe('community member removal cache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    queryClient.setQueryData(communityKeys.members(communityId), members);
    queryClient.setQueryData(communityKeys.detail(communityId), {
      id: communityId,
      memberCount: 2,
      followerCount: 2
    });
  });

  afterEach(() => queryClient.clear());

  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('updates member and count caches after confirmed removal', async () => {
    mockRemoveMember.mockResolvedValue(undefined);
    const { result, unmount } = await renderHook(() => useRemoveCommunityMember(communityId), { wrapper });

    await act(async () => { await result.current.mutateAsync('member-1'); });

    expect(queryClient.getQueryData(communityKeys.members(communityId))).toEqual([members[0]]);
    expect(queryClient.getQueryData(communityKeys.detail(communityId))).toMatchObject({
      memberCount: 1,
      followerCount: 1
    });
    await unmount();
  });

  it('rolls membership caches back when removal fails', async () => {
    let rejectRemoval!: (error: Error) => void;
    mockRemoveMember.mockReturnValue(new Promise<void>((_resolve, reject) => { rejectRemoval = reject; }));
    const { result, unmount } = await renderHook(() => useRemoveCommunityMember(communityId), { wrapper });

    let removal!: Promise<void>;
    await act(async () => {
      removal = result.current.mutateAsync('member-1');
      await Promise.resolve();
    });
    expect(queryClient.getQueryData(communityKeys.members(communityId))).toEqual([members[0]]);

    await act(async () => {
      rejectRemoval(new Error('Removal denied'));
      await expect(removal).rejects.toThrow('Removal denied');
    });

    expect(queryClient.getQueryData(communityKeys.members(communityId))).toEqual(members);
    expect(queryClient.getQueryData(communityKeys.detail(communityId))).toMatchObject({
      memberCount: 2,
      followerCount: 2
    });
    await unmount();
  });
});
