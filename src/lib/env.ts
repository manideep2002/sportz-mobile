import Constants from 'expo-constants';
import { resolveMonitoringEnvironment } from '@/lib/monitoringPrivacy';

const runtimeEnv = Constants.expoConfig?.extra ?? {};

const placeholderFragments = ['your-project-ref', 'example.supabase.co', 'replace-me', 'replace_me'];

const isConfiguredValue = (value?: string) => {
  const configuredValue = value?.trim();
  if (!configuredValue) return false;
  return !placeholderFragments.some((fragment) => configuredValue.includes(fragment));
};

const validHttpsUrl = (value?: string): string | undefined => {
  const url = value?.trim();
  if (!url || !isConfiguredValue(url)) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
};

const validSupportEmail = (value?: string): string | undefined => {
  const email = value?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && isConfiguredValue(email)
    ? email
    : undefined;
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
const supportEmail = validSupportEmail(
  getProcessEnv('EXPO_PUBLIC_SUPPORT_EMAIL') ?? getRuntimeEnv('EXPO_PUBLIC_SUPPORT_EMAIL')
);
const supportUrl = validHttpsUrl(
  getProcessEnv('EXPO_PUBLIC_SUPPORT_URL') ?? getRuntimeEnv('EXPO_PUBLIC_SUPPORT_URL')
);
const appStoreUrl = validHttpsUrl(
  getProcessEnv('EXPO_PUBLIC_APP_STORE_URL') ?? getRuntimeEnv('EXPO_PUBLIC_APP_STORE_URL')
);
const playStoreUrl = validHttpsUrl(
  getProcessEnv('EXPO_PUBLIC_PLAY_STORE_URL') ?? getRuntimeEnv('EXPO_PUBLIC_PLAY_STORE_URL')
);
const installFallbackUrl = validHttpsUrl(
  getProcessEnv('EXPO_PUBLIC_INSTALL_FALLBACK_URL') ?? getRuntimeEnv('EXPO_PUBLIC_INSTALL_FALLBACK_URL')
);

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  googleIosClientId: getProcessEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') ?? getRuntimeEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
  googleAndroidClientId: getProcessEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') ?? getRuntimeEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
  googleWebClientId: getProcessEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ?? getRuntimeEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  appScheme: getProcessEnv('EXPO_PUBLIC_APP_SCHEME') ?? getRuntimeEnv('EXPO_PUBLIC_APP_SCHEME') ?? 'sportz',
  canonicalWebUrl,
  supportEmail,
  supportUrl,
  appStoreUrl,
  playStoreUrl,
  installFallbackUrl,
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
