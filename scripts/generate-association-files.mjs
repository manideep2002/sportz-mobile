import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const buildAppleAssociation = (teamId, bundleId = 'com.sportz.mobile') => {
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    throw new Error('IOS_TEAM_ID must be the 10-character Apple Developer Team ID.');
  }
  return {
    applinks: {
      apps: [],
      details: [{
        appIDs: [`${teamId}.${bundleId}`],
        components: [{ '/': '/posts/*' }, { '/': '/profiles/*' }, { '/': '/events/*' },
          { '/': '/courts/*' }, { '/': '/groups/*' }, { '/': '/pages/*' },
          { '/': '/invitations/community/*' }]
      }]
    }
  };
};

export const buildAndroidAssociation = (
  fingerprints,
  packageName = 'com.sportz.mobile'
) => {
  const values = fingerprints
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
  if (!values.length || values.some((value) => !fingerprintPattern.test(value))) {
    throw new Error('ANDROID_SHA256_CERT_FINGERPRINTS must contain production SHA-256 fingerprints.');
  }
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: values
    }
  }];
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const outputDirectory = path.resolve('public', '.well-known');
  const apple = buildAppleAssociation(process.env.IOS_TEAM_ID ?? '');
  const android = buildAndroidAssociation(process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? '');
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'apple-app-site-association'), `${JSON.stringify(apple, null, 2)}\n`),
    writeFile(path.join(outputDirectory, 'assetlinks.json'), `${JSON.stringify(android, null, 2)}\n`)
  ]);
  process.stdout.write(`Association files generated in ${outputDirectory}\n`);
}

