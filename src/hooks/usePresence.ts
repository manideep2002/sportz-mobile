import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

export const usePresence = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const setOnlineUserIds = useUiStore((state) => state.setOnlineUserIds);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase.channel('sportz-presence', {
      config: { presence: { key: userId } }
    });

    const syncPresence = () => {
      const presence = channel.presenceState();
      setOnlineUserIds(Object.keys(presence));
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
          await supabase.from('profiles').update({ is_online: true }).eq('id', userId);
        }
      });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void channel.track({ user_id: userId, online_at: new Date().toISOString() });
        void supabase.from('profiles').update({ is_online: true }).eq('id', userId);
      } else {
        void channel.untrack();
        void supabase.from('profiles').update({ is_online: false }).eq('id', userId);
      }
    });

    return () => {
      appStateSubscription.remove();
      void channel.untrack();
      void supabase.from('profiles').update({ is_online: false }).eq('id', userId);
      void supabase.removeChannel(channel);
    };
  }, [setOnlineUserIds, userId]);
};

