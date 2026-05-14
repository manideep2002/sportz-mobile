import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { notifications } from '@/data/mockData';
import type { SportzNotification, UserProfile } from '@/types/domain';

export const notificationService = {
  async listNotifications(): Promise<SportzNotification[]> {
    if (!env.isSupabaseConfigured) return notifications;

    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(*)')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error || !data) return notifications;

    return data.map((row: any) => ({
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
      entityId: row.entity_id ?? undefined
    }));
  },

  async markAllRead(): Promise<void> {
    if (!env.isSupabaseConfigured) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', authData.user.id)
      .is('read_at', null);

    if (error) throw error;
  }
};
