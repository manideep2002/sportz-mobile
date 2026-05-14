import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';

export const useAuthBootstrap = () => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) {
      void bootstrap();
    }
  }, [bootstrap, bootstrapped]);
};
