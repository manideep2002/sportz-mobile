import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export const useAuthBootstrap = () => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const handleAuthStateChange = useAuthStore((state) => state.handleAuthStateChange);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Return from Supabase's callback before performing profile queries. This
      // avoids waiting on other auth/database calls while the auth lock is held.
      queueMicrotask(() => {
        if (active) void handleAuthStateChange(event, session);
      });
    });

    void bootstrap();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [bootstrap, handleAuthStateChange]);
};
