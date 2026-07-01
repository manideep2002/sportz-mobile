import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { UserProfile } from '@/types/domain';

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You must be signed in.');
  return data.user.id;
};

export const toBlockedIdSet = (blockedIds: unknown): Set<string> => {
  if (blockedIds instanceof Set) {
    return new Set([...blockedIds].filter((id): id is string => typeof id === 'string'));
  }

  if (Array.isArray(blockedIds)) {
    return new Set(blockedIds.filter((id): id is string => typeof id === 'string'));
  }

  if (blockedIds && typeof blockedIds === 'object') {
    return new Set(
      Object.values(blockedIds).filter((id): id is string => typeof id === 'string')
    );
  }

  return new Set();
};

export const blockService = {
  async blockUser(userId: string): Promise<void> {
    assertSupabaseConfigured();
    const currentUserId = await getCurrentUserId();

    const { error } = await supabase.from('blocks').insert({
      blocker_id: currentUserId,
      blocked_id: userId
    });
    if (error && error.code !== '23505') throw error;
  },

  async unblockUser(userId: string): Promise<void> {
    assertSupabaseConfigured();
    const currentUserId = await getCurrentUserId();

    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId);
    if (error) throw error;
  },

  async isBlocked(userId: string): Promise<boolean> {
    assertSupabaseConfigured();
    const currentUserId = await getCurrentUserId();

    const { count, error } = await supabase
      .from('blocks')
      .select('*', { count: 'exact', head: true })
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId);
    if (error) throw error;

    return (count ?? 0) > 0;
  },

  async listBlocked(): Promise<UserProfile[]> {
    assertSupabaseConfigured();
    const currentUserId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('blocks')
      .select('profiles:blocked_id(*)')
      .eq('blocker_id', currentUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => mapProfileRow((row as { profiles: Record<string, any> | null }).profiles));
  },

  async listBlockedIds(): Promise<string[]> {
    assertSupabaseConfigured();
    const currentUserId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);
    if (error) throw error;

    return (data ?? []).map((row) => row.blocked_id as string);
  }
};

