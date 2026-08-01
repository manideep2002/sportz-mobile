import { env } from '@/lib/env';

export const appConfig = {
  name: 'SPORTZ',
  supportEmail: env.supportEmail,
  supportUrl: env.supportUrl,
  appStoreUrl: env.appStoreUrl,
  playStoreUrl: env.playStoreUrl,
  installFallbackUrl: env.installFallbackUrl
} as const;
