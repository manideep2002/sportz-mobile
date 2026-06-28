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
  read_at: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: SportzNotification['entityType'] | null;
}

const mapNotificationRow = (row: NotificationRow): SportzNotification => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  actor: row.actor ? mapProfileRow(row.actor) : undefined,
  read: Boolean(row.read_at),
  createdAt: row.created_at,
  entityId: row.entity_id ?? undefined,
  entityType: row.entity_type ?? undefined
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
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data ?? []).map((row) => mapNotificationRow(row as unknown as NotificationRow));
  },

  async markAllRead(): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', authData.user.id)
      .is('read_at', null);

    if (error) throw error;
  },

  async markAsRead(notificationId: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', authData.user.id)
      .is('read_at', null);

    if (error) throw error;
  },

  subscribeToNotifications(callback: (notification: SportzNotification) => void) {
    assertSupabaseConfigured();

    const getUserAndSubscribe = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return { unsubscribe: () => {} };

      const channel = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${authData.user.id}`
          },
          (payload) => {
            callback(mapNotificationRow(payload.new as unknown as NotificationRow));
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
