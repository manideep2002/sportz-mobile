import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const requireHttpsUrl = (value, name) => {
  try {
    const parsed = new URL(value ?? '');
    if (parsed.protocol !== 'https:') throw new Error();
    return parsed.toString();
  } catch {
    throw new Error(`${name} must be an HTTPS URL for a production fallback page.`);
  }
};

export const optionalSupport = ({ supportEmail, supportUrl }) => {
  const email = supportEmail?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { href: `mailto:${email}`, label: 'Contact Support' };
  if (supportUrl) return { href: requireHttpsUrl(supportUrl, 'EXPO_PUBLIC_SUPPORT_URL'), label: 'Contact Support' };
  return null;
};

export const buildLinkFallbackHtml = ({ appStoreUrl, playStoreUrl, supportEmail, supportUrl }) => {
  const apple = requireHttpsUrl(appStoreUrl, 'EXPO_PUBLIC_APP_STORE_URL');
  const android = requireHttpsUrl(playStoreUrl, 'EXPO_PUBLIC_PLAY_STORE_URL');
  const support = optionalSupport({ supportEmail, supportUrl });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open in SPORTZ</title>
    <meta name="description" content="Open this sports post, profile, event, court, or community in SPORTZ." />
    <meta property="og:title" content="Open in SPORTZ" />
    <meta property="og:description" content="Continue safely in SPORTZ. Private content details are never included in link previews." />
    <meta property="og:type" content="website" />
  </head>
  <body>
    <main>
      <h1>Continue in SPORTZ</h1>
      <p>Install or open SPORTZ to view this destination. Sign-in and access rules still apply.</p>
      <p><a href="${escapeHtml(apple)}">Download for iPhone</a></p>
      <p><a href="${escapeHtml(android)}">Download for Android</a></p>
      ${support ? `<p><a href="${escapeHtml(support.href)}">${support.label}</a></p>` : ''}
    </main>
  </body>
</html>
`;
};

export const releaseFallbackDestinations = (environment = process.env) => ({
  appStoreUrl: environment.EXPO_PUBLIC_APP_STORE_URL,
  playStoreUrl: environment.EXPO_PUBLIC_PLAY_STORE_URL,
  supportEmail: environment.EXPO_PUBLIC_SUPPORT_EMAIL,
  supportUrl: environment.EXPO_PUBLIC_SUPPORT_URL
});

export const writeLinkFallback = async (outputFile, destinations = releaseFallbackDestinations()) => {
  await writeFile(outputFile, buildLinkFallbackHtml(destinations));
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const outputFile = path.resolve(process.env.LINK_FALLBACK_OUTPUT_FILE ?? 'public/link-fallback.html');
  await writeLinkFallback(outputFile);
  process.stdout.write(`Link fallback generated at ${outputFile}\n`);
}
