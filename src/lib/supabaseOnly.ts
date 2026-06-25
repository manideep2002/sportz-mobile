import { env } from '@/lib/env';

export function assertSupabaseConfigured() {
  if (!env.isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add your Supabase URL and publishable key to the app environment.');
  }
}
