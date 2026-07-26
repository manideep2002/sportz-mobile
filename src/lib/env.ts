import Constants from 'expo-constants';
import { resolveMonitoringEnvironment } from '@/lib/monitoringPrivacy';

const runtimeEnv = Constants.expoConfig?.extra ?? {};

const placeholderFragments = ['your-project-ref', 'example.supabase.co', 'replace-me', 'replace_me'];

const isConfiguredValue = (value?: string) => {
  if (!value?.trim()) return false;
  return !placeholderFragments.some((fragment) => value.includes(fragment));
};

const getProcessEnv = (key: keyof typeof process.env): string | undefined => {
  return process.env[key];
};

const getRuntimeEnv = (key: string): string | undefined => {
  const value = runtimeEnv[key];
  return typeof value === 'string' ? value : undefined;
};

const supabaseUrl = getProcessEnv('EXPO_PUBLIC_SUPABASE_URL') ?? getRuntimeEnv('EXPO_PUBLIC_SUPABASE_URL') ?? 'https://example.supabase.co';
const supabasePublishableKey = getProcessEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ?? getRuntimeEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_replace_me';
const canonicalWebUrl =
  getProcessEnv('EXPO_PUBLIC_CANONICAL_WEB_URL') ??
  getRuntimeEnv('EXPO_PUBLIC_CANONICAL_WEB_URL') ??
  'https://sportz.app';

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  googleIosClientId: getProcessEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') ?? getRuntimeEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
  googleAndroidClientId: getProcessEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') ?? getRuntimeEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
  googleWebClientId: getProcessEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ?? getRuntimeEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  appScheme: getProcessEnv('EXPO_PUBLIC_APP_SCHEME') ?? getRuntimeEnv('EXPO_PUBLIC_APP_SCHEME') ?? 'sportz',
  canonicalWebUrl,
  appStoreUrl:
    getProcessEnv('EXPO_PUBLIC_APP_STORE_URL') ??
    getRuntimeEnv('EXPO_PUBLIC_APP_STORE_URL') ??
    'https://apps.apple.com/app/sportz',
  playStoreUrl:
    getProcessEnv('EXPO_PUBLIC_PLAY_STORE_URL') ??
    getRuntimeEnv('EXPO_PUBLIC_PLAY_STORE_URL') ??
    'https://play.google.com/store/apps/details?id=com.sportz.mobile',
  mapProvider: getProcessEnv('EXPO_PUBLIC_MAP_PROVIDER') ?? getRuntimeEnv('EXPO_PUBLIC_MAP_PROVIDER') ?? 'apple',
  appEnvironment: resolveMonitoringEnvironment(
    getProcessEnv('EXPO_PUBLIC_APP_ENV') ?? getRuntimeEnv('EXPO_PUBLIC_APP_ENV')
  ),
  sentryDsn: getProcessEnv('EXPO_PUBLIC_SENTRY_DSN') ?? getRuntimeEnv('EXPO_PUBLIC_SENTRY_DSN'),
  enableDevelopmentMonitoring:
    (getProcessEnv('EXPO_PUBLIC_ENABLE_DEV_MONITORING') ??
      getRuntimeEnv('EXPO_PUBLIC_ENABLE_DEV_MONITORING')) === 'true',
  isSupabaseConfigured: isConfiguredValue(supabaseUrl) && isConfiguredValue(supabasePublishableKey)
};
