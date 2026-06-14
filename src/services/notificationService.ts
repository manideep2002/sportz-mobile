import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { notifications } from '@/data/mockData';
import type { SportzNotification, UserProfile } from '@/types/domain';

const mapNotificationRow = (row: any): SportzNotification => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  actor: row.actor
    ? {
        id: row.actor.id,
        username: row.actor.username,
        displayName: row.actor.display_name,
        initials: row.actor.display_name.slice(0, 2).toUpperCase(),
        bio: row.actor.bio ?? '',
        city: row.actor.city ?? '',
        country: row.actor.country ?? '',
        primarySport: (row.actor.primary_sport as UserProfile['primarySport']) ?? 'Basketball',
        sports: (row.actor.sports as UserProfile['sports']) ?? ['Basketball'],
        skillLevel: (row.actor.skill_level as UserProfile['skillLevel']) ?? 'Intermediate',
        isOnline: false,
        badges: [],
        stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
      }
    : undefined,
  read: Boolean(row.read_at),
  createdAt: row.created_at,
  entityId: row.entity_id ?? undefined,
  entityType: row.entity_type ?? undefined
});

export const notificationService = {
  async listNotifications(limit = 40, offset = 0): Promise<SportzNotification[]> {
    if (!env.isSupabaseConfigured) {
      return notifications.slice(offset, offset + limit);
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(*)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return notifications.slice(offset, offset + limit);

    return data.map(mapNotificationRow);
  },

  async markAllRead(): Promise<void> {
    if (!env.isSupabaseConfigured) {
      notifications.forEach((n) => (n.read = true));
      return;
    }

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
    if (!env.isSupabaseConfigured) {
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification) notification.read = true;
      return;
    }

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
    if (!env.isSupabaseConfigured) return { unsubscribe: () => {} };

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
            const newNotification = mapNotificationRow(payload.new);
            callback(newNotification);
          }
        )
        .subscribe();

      return {
        unsubscribe: () => {
          supabase.removeChannel(channel);
        }
      };
    };

    // Return a promise that resolves to the subscription
    // The caller should handle the promise
    return getUserAndSubscribe();
  }
};
