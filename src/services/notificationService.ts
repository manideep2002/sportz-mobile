import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { SportzNotification } from '@/types/domain';

/** Shape of an actor (profile) embedded in a notification row. */
interface NotificationActor {
  id: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  primary_sport?: string | null;
  city?: string | null;
  country?: string | null;
  sports?: string[] | null;
  skill_level?: string | null;
  is_verified?: boolean | null;
  is_hireable?: boolean | null;
}

/** Shape of a raw row from the `notifications` table with joined actor profile. */
interface NotificationRow {
  id: string;
  kind: SportzNotification['kind'];
  title: string;
  body: string;
  actor: NotificationActor | null;
  actor_ids?: string[] | null;
  actor_count?: number | null;
  is_read?: boolean | null;
  read_at: string | null;
  created_at: string;
  last_event_at?: string | null;
  entity_id: string | null;
  entity_type: SportzNotification['entityType'] | null;
  data?: Record<string, unknown> | null;
}

const mapNotificationRow = (row: NotificationRow): SportzNotification => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  actor: row.actor ? mapProfileRow(row.actor) : undefined,
  actorIds: row.actor_ids ?? undefined,
  actorCount: row.actor_count ?? undefined,
  read: row.is_read ?? Boolean(row.read_at),
  createdAt: row.last_event_at ?? row.created_at,
  lastEventAt: row.last_event_at ?? undefined,
  entityId: row.entity_id ?? undefined,
  entityType: row.entity_type ?? undefined,
  data: row.data ?? undefined
});

export const notificationService = {
  async listNotifications(limit = 40, offset = 0): Promise<SportzNotification[]> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(*)')
      .eq('user_id', authData.user.id)
      .order('last_event_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data ?? []).map((row) => mapNotificationRow(row as unknown as NotificationRow));
  },

  async countUnread(): Promise<number> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authData.user.id)
      .eq('is_read', false);

    if (error) throw error;
    return count ?? 0;
  },

  async markAllRead(): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', authData.user.id)
      .eq('is_read', false);

    if (error) throw error;
  },

  async markAsRead(notificationId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', authData.user.id)
      .eq('is_read', false);

    if (error) throw error;
  },

  subscribeToNotifications(
    callback: (
      notification: SportzNotification,
      event: { type: 'INSERT' | 'UPDATE'; previousRead?: boolean }
    ) => void
  ) {
    assertSupabaseConfigured();

    const getUserAndSubscribe = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return { unsubscribe: () => {} };

      const channel = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${authData.user.id}`
          },
          async (payload) => {
            if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
            const oldRow = payload.old as { is_read?: boolean | null; read_at?: string | null } | null;
            const event = {
              type: payload.eventType,
              previousRead:
                payload.eventType === 'UPDATE' && oldRow
                  ? oldRow.is_read ?? Boolean(oldRow.read_at)
                  : undefined
            } as const;
            const row = payload.new as { id?: string };
            if (row.id) {
              const { data } = await supabase
                .from('notifications')
                .select('*, actor:actor_id(*)')
                .eq('id', row.id)
                .single();
              if (data) {
                callback(mapNotificationRow(data as unknown as NotificationRow), event);
                return;
              }
            }
            callback(mapNotificationRow(payload.new as unknown as NotificationRow), event);
          }
        )
        .subscribe();

      return {
        unsubscribe: () => {
          supabase.removeChannel(channel);
        }
      };
    };

    return getUserAndSubscribe();
  }
};
