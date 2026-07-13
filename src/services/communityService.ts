import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type {
  Community,
  CommunityInvite,
  CommunityJoinRequest,
  CommunityMember,
  CommunityMemberRole,
  CommunityMembershipStatus
} from '@/types/domain';

interface CommunityRow {
  id: string;
  type: Community['type'];
  name: string;
  slug: string | null;
  description: string | null;
  sport: string;
  city: string | null;
  is_private?: boolean | null;
  is_verified: boolean | null;
  member_count: number | null;
  follower_count: number | null;
}

export interface CreateCommunityInput {
  name: string;
  type: Community['type'];
  sport: string;
  city: string;
  description: string;
  isPrivate?: boolean;
}

type JoinCommunityResult = 'joined' | 'requested';

interface MembershipState {
  role?: CommunityMemberRole | null;
  pendingInviteId?: string;
  pendingRequestId?: string;
}

interface CommunityMemberStateRow {
  community_id: string;
  role: CommunityMemberRole;
}

interface PendingInviteStateRow {
  id: string;
  community_id: string;
}

interface PendingRequestStateRow {
  id: string;
  community_id: string;
}

const missingOptionalSchemaCodes = new Set(['42P01', '42703', 'PGRST200', 'PGRST202', 'PGRST204']);

const isOptionalSchemaError = (error: { code?: string } | null | undefined) =>
  Boolean(error?.code && missingOptionalSchemaCodes.has(error.code));

const firstRelation = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const fallbackCommunityRow = (name = 'Community'): CommunityRow => ({
  id: '',
  type: 'group',
  name,
  slug: null,
  description: null,
  sport: 'Basketball',
  city: null,
  is_private: false,
  is_verified: false,
  member_count: 0,
  follower_count: 0
});

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

const membershipStatusFor = (state: MembershipState): CommunityMembershipStatus => {
  if (state.role === 'owner') return 'owner';
  if (state.role === 'admin') return 'admin';
  if (state.role) return 'joined';
  if (state.pendingInviteId) return 'invited';
  if (state.pendingRequestId) return 'requested';
  return 'none';
};

const mapCommunityRow = (row: CommunityRow, extras: Partial<Community> = {}): Community => {
  const state: MembershipState = {
    role: extras.membershipRole,
    pendingInviteId: extras.pendingInviteId,
    pendingRequestId: extras.pendingRequestId
  };
  const membershipStatus = extras.membershipStatus ?? membershipStatusFor(state);
  const isMember = extras.isMember ?? Boolean(state.role);
  const isAdmin = extras.isAdmin ?? (state.role === 'owner' || state.role === 'admin');

  return {
    id: row.id,
    type: row.type as Community['type'],
    name: row.name,
    slug: row.slug ?? row.id,
    description: row.description ?? '',
    sport: row.sport,
    city: row.city ?? '',
    isPrivate: Boolean(row.is_private),
    isVerified: Boolean(row.is_verified),
    memberCount: row.member_count ?? 0,
    followerCount: row.follower_count ?? 0,
    isMember,
    isAdmin,
    canViewContent: extras.canViewContent ?? (row.type === 'page' ? true : isMember),
    canManageMembers: extras.canManageMembers ?? isAdmin,
    membershipRole: state.role ?? null,
    membershipStatus,
    ...extras
  };
};

const mapStateExtras = (row: CommunityRow, state: MembershipState): Partial<Community> => {
  const role = state.role ?? null;
  const isAdmin = role === 'owner' || role === 'admin';
  const isMember = Boolean(role);

  return {
    membershipRole: role,
    pendingInviteId: state.pendingInviteId,
    pendingRequestId: state.pendingRequestId,
    membershipStatus: membershipStatusFor(state),
    isAdmin,
    isMember,
    canManageMembers: isAdmin,
    canViewContent: row.type === 'page' ? true : isMember
  };
};

export const communityService = {
  async listCommunities(): Promise<Community[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = (data ?? []) as CommunityRow[];
    const ids = rows.map((row) => row.id);
    if (!ids.length) return [];

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return rows.map((row) => mapCommunityRow(row));

    const [memberResult, inviteResult, requestResult] = await Promise.all([
      supabase
        .from('community_members')
        .select('community_id, role')
        .eq('user_id', authData.user.id)
        .in('community_id', ids),
      supabase
        .from('community_invites')
        .select('id, community_id')
        .eq('invitee_id', authData.user.id)
        .eq('status', 'pending')
        .in('community_id', ids),
      supabase
        .from('community_join_requests')
        .select('id, community_id')
        .eq('requester_id', authData.user.id)
        .eq('status', 'pending')
        .in('community_id', ids)
    ]);

    if (memberResult.error) throw memberResult.error;
    if (inviteResult.error && !isOptionalSchemaError(inviteResult.error)) throw inviteResult.error;
    if (requestResult.error && !isOptionalSchemaError(requestResult.error)) throw requestResult.error;

    const memberByCommunity = new Map(
      ((memberResult.data ?? []) as CommunityMemberStateRow[]).map((row) => [row.community_id, row.role])
    );
    const inviteByCommunity = new Map(
      ((inviteResult.data ?? []) as PendingInviteStateRow[]).map((row) => [row.community_id, row.id])
    );
    const requestByCommunity = new Map(
      ((requestResult.data ?? []) as PendingRequestStateRow[]).map((row) => [row.community_id, row.id])
    );

    return rows.map((row) => mapCommunityRow(row, mapStateExtras(row, {
      role: memberByCommunity.get(row.id) ?? null,
      pendingInviteId: inviteByCommunity.get(row.id),
      pendingRequestId: requestByCommunity.get(row.id)
    })));
  },

  async getCommunity(id: string): Promise<Community | null> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [countResult, authResult] = await Promise.all([
      supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', id),
      supabase.auth.getUser()
    ]);
    if (countResult.error) throw countResult.error;
    if (authResult.error) throw authResult.error;

    let role: CommunityMemberRole | null = null;
    let pendingInviteId: string | undefined;
    let pendingRequestId: string | undefined;
    if (authResult.data.user) {
      const [memberResult, inviteResult, requestResult] = await Promise.all([
        supabase
          .from('community_members')
          .select('role')
          .eq('community_id', id)
          .eq('user_id', authResult.data.user.id)
          .maybeSingle(),
        supabase
          .from('community_invites')
          .select('id')
          .eq('community_id', id)
          .eq('invitee_id', authResult.data.user.id)
          .eq('status', 'pending')
          .maybeSingle(),
        supabase
          .from('community_join_requests')
          .select('id')
          .eq('community_id', id)
          .eq('requester_id', authResult.data.user.id)
          .eq('status', 'pending')
          .maybeSingle()
      ]);
      if (memberResult.error) throw memberResult.error;
      if (inviteResult.error && !isOptionalSchemaError(inviteResult.error)) throw inviteResult.error;
      if (requestResult.error && !isOptionalSchemaError(requestResult.error)) throw requestResult.error;

      const memberRow = memberResult.data as { role?: CommunityMemberRole } | null;
      const inviteRow = inviteResult.data as { id?: string } | null;
      const requestRow = requestResult.data as { id?: string } | null;
      role = memberRow?.role ?? null;
      pendingInviteId = inviteRow?.id;
      pendingRequestId = requestRow?.id;
    }

    const liveCount = countResult.count ?? 0;
    const row = data as CommunityRow;
    return mapCommunityRow(row, {
      memberCount: liveCount,
      followerCount: liveCount,
      ...mapStateExtras(row, { role, pendingInviteId, pendingRequestId })
    });
  },

  async createCommunity(input: CreateCommunityInput): Promise<Community> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to create a community.');

    const { data, error } = await supabase
      .from('communities')
      .insert({
        type: input.type,
        name: input.name.trim(),
        slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
        description: input.description.trim(),
        sport: input.sport,
        city: input.city.trim(),
        is_private: input.type === 'group' ? Boolean(input.isPrivate) : false,
        created_by: authData.user.id
      })
      .select('*')
      .single();
    if (error) throw error;

    const { error: memberError } = await supabase.from('community_members').insert({
      community_id: data.id,
      user_id: authData.user.id,
      role: 'owner'
    });
    if (memberError) throw memberError;

    return mapCommunityRow(data as CommunityRow, {
      memberCount: 1,
      followerCount: 1,
      membershipRole: 'owner',
      membershipStatus: 'owner',
      isAdmin: true,
      isMember: true,
      canManageMembers: true,
      canViewContent: true
    });
  },

  async joinCommunity(communityId: string, role: 'member' | 'follower' = 'member'): Promise<JoinCommunityResult> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to join.');

    const { data, error: rpcError } = await supabase.rpc('join_community', {
      target_community_id: communityId,
      requested_role: role
    });
    if (!rpcError) return data === 'requested' ? 'requested' : 'joined';
    if (!isOptionalSchemaError(rpcError)) throw rpcError;

    const { error } = await supabase.from('community_members').upsert({
      community_id: communityId,
      user_id: authData.user.id,
      role
    });
    if (error) throw error;

    const { error: inviteError } = await supabase
      .from('community_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('community_id', communityId)
      .eq('invitee_id', authData.user.id)
      .eq('status', 'pending');
    if (inviteError && inviteError.code !== '42P01') throw inviteError;
    return 'joined';
  },

  async leaveCommunity(communityId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to leave.');

    const { error: rpcError } = await supabase.rpc('leave_community', {
      target_community_id: communityId
    });
    if (!rpcError) return;
    if (!isOptionalSchemaError(rpcError)) throw rpcError;

    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', authData.user.id);
    if (error) throw error;
  },

  async inviteMember(communityId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('invite_community_member', {
      target_community_id: communityId,
      target_user_id: userId
    });
    if (error) throw error;
  },

  async respondToInvite(inviteId: string, approve: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('respond_community_invite', {
      invite_id: inviteId,
      approve
    });
    if (error) throw error;
  },

  async respondToInviteForCommunity(communityId: string, approve: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to respond to invites.');

    const { data, error } = await supabase
      .from('community_invites')
      .select('id')
      .eq('community_id', communityId)
      .eq('invitee_id', authData.user.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('Invite not found.');

    await this.respondToInvite(data.id as string, approve);
  },

  async listPendingInvites(): Promise<CommunityInvite[]> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    const { data, error } = await supabase
      .from('community_invites')
      .select('id, status, created_at, community:community_id(*), inviter:inviter_id(*)')
      .eq('invitee_id', authData.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => {
      const invite = row as unknown as {
        id: string;
        status: CommunityInvite['status'];
        created_at: string;
        community: CommunityRow | CommunityRow[] | null;
        inviter: Record<string, any> | Record<string, any>[] | null;
      };
      const community = firstRelation(invite.community);
      const inviter = firstRelation(invite.inviter);

      return {
        id: invite.id,
        status: invite.status,
        createdAt: invite.created_at,
        inviter: inviter ? mapProfileRow(inviter) : undefined,
        community: mapCommunityRow(community ?? fallbackCommunityRow(), {
          pendingInviteId: invite.id,
          membershipStatus: 'invited'
        })
      };
    });
  },

  async listMembers(communityId: string): Promise<CommunityMember[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('community_members')
      .select('user_id, role, created_at, profiles:user_id(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      userId: (row as { user_id: string }).user_id,
      role: (row as { role: CommunityMemberRole }).role,
      joinedAt: (row as { created_at: string }).created_at,
      profile: mapProfileRow((row as { profiles: Record<string, any> | null }).profiles)
    }));
  },

  async listJoinRequests(communityId: string): Promise<CommunityJoinRequest[]> {
    assertSupabaseConfigured();

    const { data, error } = await supabase
      .from('community_join_requests')
      .select('id, community_id, status, created_at, requester:requester_id(*)')
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row) => {
      const request = row as unknown as {
        id: string;
        community_id: string;
        status: CommunityJoinRequest['status'];
        created_at: string;
        requester: Record<string, any> | Record<string, any>[] | null;
      };

      return {
        id: request.id,
        communityId: request.community_id,
        status: request.status,
        createdAt: request.created_at,
        requester: mapProfileRow(firstRelation(request.requester))
      };
    });
  },

  async respondToJoinRequest(requestId: string, approve: boolean): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('respond_community_join_request', {
      request_id: requestId,
      approve
    });
    if (error) throw error;
  },

  async updateMemberRole(communityId: string, userId: string, role: Exclude<CommunityMemberRole, 'owner'>): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('update_community_member_role', {
      target_community_id: communityId,
      target_user_id: userId,
      target_role: role
    });
    if (error) throw error;
  },

  async removeMember(communityId: string, userId: string): Promise<void> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('remove_community_member', {
      target_community_id: communityId,
      target_user_id: userId
    });
    if (error) throw error;
  }
};
