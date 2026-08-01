import type { Community, CommunityMember } from '@/types/domain';

export interface CommunityMemberManagementCapabilities {
  canChangeRole: boolean;
  canRemove: boolean;
  canTransferOwnership: boolean;
}

export function getCommunityMemberManagementCapabilities(
  community: Pick<Community, 'canManageMembers' | 'isOwner' | 'membershipRole'>,
  member: Pick<CommunityMember, 'userId' | 'role'>,
  currentUserId?: string
): CommunityMemberManagementCapabilities {
  const isSelf = Boolean(currentUserId && member.userId === currentUserId);
  const actorIsOwner = community.isOwner === true || community.membershipRole === 'owner';
  const actorIsAdministrator = community.canManageMembers === true;
  const targetIsOwner = member.role === 'owner';
  const targetIsAdministrator = member.role === 'admin';

  return {
    canChangeRole: actorIsOwner && !isSelf && !targetIsOwner,
    canRemove: actorIsAdministrator && !isSelf && !targetIsOwner && (actorIsOwner || !targetIsAdministrator),
    canTransferOwnership: actorIsOwner && !isSelf && !targetIsOwner && member.role !== 'follower'
  };
}
