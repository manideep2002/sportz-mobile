import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';

if (typeof globalThis.WebSocket === 'undefined') {
  // Provide dummy WebSocket constructor for Node test environment when native WebSocket is absent
  // @ts-ignore
  globalThis.WebSocket = class DummyWebSocket {};
}

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
