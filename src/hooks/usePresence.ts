import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

export const usePresence = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const setOnlineUserIds = useUiStore((state) => state.setOnlineUserIds);

  useEffect(() => {
    setOnlineUserIds([]);
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
          if (AppState.currentState === 'active') {
            await channel.track({ user_id: userId, online_at: new Date().toISOString() });
            syncPresence();
            await supabase.from('profiles').update({ is_online: true }).eq('id', userId);
          } else {
            await channel.untrack();
            setOnlineUserIds([]);
            await supabase.from('profiles').update({ is_online: false }).eq('id', userId);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setOnlineUserIds([]);
        }
      });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void channel
          .track({ user_id: userId, online_at: new Date().toISOString() })
          .then(syncPresence);
        void supabase.from('profiles').update({ is_online: true }).eq('id', userId);
      } else {
        setOnlineUserIds([]);
        void channel.untrack();
        void supabase.from('profiles').update({ is_online: false }).eq('id', userId);
      }
    });

    return () => {
      appStateSubscription.remove();
      setOnlineUserIds([]);
      void channel.untrack();
      void supabase.from('profiles').update({ is_online: false }).eq('id', userId);
      void supabase.removeChannel(channel);
    };
  }, [setOnlineUserIds, userId]);
};
