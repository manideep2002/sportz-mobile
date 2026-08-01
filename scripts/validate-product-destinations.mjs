import { optionalSupport, requireHttpsUrl } from './generate-link-fallback.mjs';

export const validateProductDestinations = (environment = process.env) => {
  const support = optionalSupport({
    supportEmail: environment.EXPO_PUBLIC_SUPPORT_EMAIL,
    supportUrl: environment.EXPO_PUBLIC_SUPPORT_URL
  });
  if (!support) {
    throw new Error('Set EXPO_PUBLIC_SUPPORT_EMAIL or EXPO_PUBLIC_SUPPORT_URL before a production release.');
  }

  return {
    support,
    appStoreUrl: requireHttpsUrl(environment.EXPO_PUBLIC_APP_STORE_URL, 'EXPO_PUBLIC_APP_STORE_URL'),
    playStoreUrl: requireHttpsUrl(environment.EXPO_PUBLIC_PLAY_STORE_URL, 'EXPO_PUBLIC_PLAY_STORE_URL'),
    installFallbackUrl: requireHttpsUrl(
      environment.EXPO_PUBLIC_INSTALL_FALLBACK_URL,
      'EXPO_PUBLIC_INSTALL_FALLBACK_URL'
    )
  };
};

try {
  validateProductDestinations();
  process.stdout.write('Product destinations are valid.\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
