import Constants from 'expo-constants';

const runtimeEnv = Constants.expoConfig?.extra ?? {};

const placeholderFragments = ['your-project-ref', 'example.supabase.co', 'replace-me', 'replace_me'];

const isConfiguredValue = (value?: string) => {
  if (!value?.trim()) return false;
  return !placeholderFragments.some((fragment) => value.includes(fragment));
};

function getEnv(key: string): string | undefined;
function getEnv(key: string, fallback: string): string;
function getEnv(key: string, fallback?: string) {
  const processValue = process.env[key];
  const runtimeValue = runtimeEnv[key];

  if (typeof processValue === 'string') {
    return processValue;
  }

  if (typeof runtimeValue === 'string') {
    return runtimeValue;
  }

  return fallback;
}

const supabaseUrl = getEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
const supabasePublishableKey = getEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_replace_me');

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  googleIosClientId: getEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
  googleAndroidClientId: getEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
  googleWebClientId: getEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  appScheme: getEnv('EXPO_PUBLIC_APP_SCHEME', 'sportz'),
  mapProvider: getEnv('EXPO_PUBLIC_MAP_PROVIDER', 'apple'),
  isSupabaseConfigured: isConfiguredValue(supabaseUrl) && isConfiguredValue(supabasePublishableKey)
};
