import { useEffect, useState } from 'react';

import {
  usernameAvailabilityService,
  type UsernameAvailabilityResult
} from '@/services/usernameAvailabilityService';
import { useDebounce } from '@/hooks/useDebounce';

export const useUsernameAvailability = (username: string, currentUsername?: string | null) => {
  const [availability, setAvailability] = useState<UsernameAvailabilityResult>(() =>
    usernameAvailabilityService.getInstantAvailability(username, currentUsername)
  );
  const debouncedUsername = useDebounce(username, 180);

  useEffect(() => {
    let mounted = true;

    void usernameAvailabilityService.warmUsernameFilter().then(() => {
      if (!mounted) return;
      setAvailability(usernameAvailabilityService.getInstantAvailability(username, currentUsername));
    });

    return () => {
      mounted = false;
    };
  }, [currentUsername, username]);

  useEffect(() => {
    let cancelled = false;
    const instant = usernameAvailabilityService.getInstantAvailability(username, currentUsername);
    setAvailability(instant);

    if (instant.status !== 'checking' || debouncedUsername !== username) {
      return () => {
        cancelled = true;
      };
    }

    void usernameAvailabilityService
      .verifyUsernameAvailability(debouncedUsername, currentUsername)
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setAvailability({
            status: 'unknown',
            source: 'database',
            username: instant.username,
            message: error instanceof Error ? error.message : 'Could not verify username right now.'
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUsername, debouncedUsername, username]);

  return availability;
};
