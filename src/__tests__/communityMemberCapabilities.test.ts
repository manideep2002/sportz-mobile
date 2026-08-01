import type { Community, CommunityMember, CommunityMemberRole } from '@/types/domain';
import { getCommunityMemberManagementCapabilities } from '@/utils/communityCapabilities';

const community = (role: CommunityMemberRole | null, canManageMembers: boolean): Community => ({
  id: 'community-1',
  type: 'group',
  name: 'Test community',
  slug: 'test-community',
  description: '',
  sport: 'Cricket',
  city: '',
  memberCount: 4,
  membershipRole: role,
  isOwner: role === 'owner',
  canManageMembers
});

const member = (role: CommunityMemberRole, userId = `target-${role}`): CommunityMember => ({
  userId,
  role,
  joinedAt: '2026-08-01T00:00:00.000Z',
  profile: { id: userId } as CommunityMember['profile']
});

describe('community member management capabilities', () => {
  it.each([
    ['member', true],
    ['follower', true],
    ['admin', true],
    ['owner', false]
  ] as const)('lets an owner remove eligible %s targets: %s', (targetRole, expected) => {
    expect(getCommunityMemberManagementCapabilities(community('owner', true), member(targetRole), 'owner-1').canRemove)
      .toBe(expected);
  });

  it.each([
    ['member', true],
    ['follower', true],
    ['admin', false],
    ['owner', false]
  ] as const)('applies administrator hierarchy to %s targets: %s', (targetRole, expected) => {
    expect(getCommunityMemberManagementCapabilities(community('admin', true), member(targetRole), 'admin-1').canRemove)
      .toBe(expected);
  });

  it('does not render management actions for ordinary members or the acting account', () => {
    expect(getCommunityMemberManagementCapabilities(community('member', false), member('member'), 'member-1'))
      .toEqual({ canChangeRole: false, canRemove: false, canTransferOwnership: false });
    expect(getCommunityMemberManagementCapabilities(community('admin', true), member('member', 'admin-1'), 'admin-1'))
      .toEqual({ canChangeRole: false, canRemove: false, canTransferOwnership: false });
  });

  it('keeps role changes and ownership transfer owner-only', () => {
    expect(getCommunityMemberManagementCapabilities(community('admin', true), member('member'), 'admin-1'))
      .toMatchObject({ canChangeRole: false, canTransferOwnership: false });
    expect(getCommunityMemberManagementCapabilities(community('owner', true), member('member'), 'owner-1'))
      .toMatchObject({ canChangeRole: true, canTransferOwnership: true });
  });
});
