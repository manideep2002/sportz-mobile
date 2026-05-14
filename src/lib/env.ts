export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_replace_me',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'sportz',
  mapProvider: process.env.EXPO_PUBLIC_MAP_PROVIDER ?? 'apple',
  isSupabaseConfigured: Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
};
