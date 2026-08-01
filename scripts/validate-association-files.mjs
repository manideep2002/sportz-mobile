import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  buildAndroidAssociation,
  buildAppleAssociation,
  releaseAssociationIdentity
} from './generate-association-files.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

export const validateAssociationPayloads = (apple, android, identity = releaseAssociationIdentity()) => {
  const expectedApple = buildAppleAssociation(identity.teamId, identity.iosBundleId);
  const expectedAndroid = buildAndroidAssociation(identity.androidFingerprints, identity.androidApplicationId);
  if (JSON.stringify(apple) !== JSON.stringify(expectedApple)) {
    throw new Error('apple-app-site-association does not match the approved release identity and routes.');
  }
  if (JSON.stringify(android) !== JSON.stringify(expectedAndroid)) {
    throw new Error('assetlinks.json does not match the approved production signing identity and routes.');
  }
  return true;
};

const cacheIsSafe = (value) => {
  const match = /max-age=(\d+)/i.exec(value ?? '');
  return Boolean(match && Number(match[1]) >= 300 && Number(match[1]) <= 86400);
};

export const validateRemoteAssociationEndpoints = async (canonicalWebUrl, fetcher = fetch) => {
  const base = new URL(canonicalWebUrl);
  if (base.protocol !== 'https:') throw new Error('EXPO_PUBLIC_CANONICAL_WEB_URL must use HTTPS.');
  const endpoints = ['apple-app-site-association', 'assetlinks.json'];
  const values = await Promise.all(endpoints.map(async (name) => {
    const response = await fetcher(new URL(`/.well-known/${name}`, base), { redirect: 'manual' });
    if (response.status !== 200 || response.headers.get('location')) {
      throw new Error(`${name} must return HTTPS 200 directly, without a redirect.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(`${name} must be served with Content-Type: application/json.`);
    }
    if (!cacheIsSafe(response.headers.get('cache-control'))) {
      throw new Error(`${name} must set Cache-Control with max-age between 300 and 86400 seconds.`);
    }
    return response.json();
  }));
  return { apple: values[0], android: values[1] };
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const identity = releaseAssociationIdentity();
  const outputDirectory = path.resolve(process.env.ASSOCIATION_OUTPUT_DIRECTORY ?? 'public/.well-known');
  const apple = await readJson(path.join(outputDirectory, 'apple-app-site-association'));
  const android = await readJson(path.join(outputDirectory, 'assetlinks.json'));
  validateAssociationPayloads(apple, android, identity);
  if (process.argv.includes('--remote')) {
    const remote = await validateRemoteAssociationEndpoints(process.env.EXPO_PUBLIC_CANONICAL_WEB_URL ?? 'https://sportz.app');
    validateAssociationPayloads(remote.apple, remote.android, identity);
  }
  process.stdout.write('Association files match the release identity, route set, and endpoint requirements.\n');
}
