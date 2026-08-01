import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const DEFAULT_IOS_BUNDLE_IDENTIFIER = 'com.sportz.mobile';
export const DEFAULT_ANDROID_APPLICATION_ID = 'com.sportz.mobile';
export const appLinkPaths = [
  '/posts/*',
  '/profiles/*',
  '/events/*',
  '/courts/*',
  '/groups/*',
  '/pages/*',
  '/invitations/community/*',
  '/booking/*',
  '/offer/*',
  '/reset-password'
];

const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const bundleIdentifierPattern = /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)+$/;

export const validateBundleIdentifier = (value, name) => {
  if (!bundleIdentifierPattern.test(value)) {
    throw new Error(`${name} must be a valid reverse-DNS application identifier.`);
  }
  return value;
};

export const parseAndroidFingerprints = (fingerprints) => {
  const values = fingerprints
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (!values.length || values.some((value) => !fingerprintPattern.test(value))) {
    throw new Error('ANDROID_SHA256_CERT_FINGERPRINTS must contain production SHA-256 fingerprints.');
  }
  return [...new Set(values)];
};

export const buildAppleAssociation = (teamId, bundleId = DEFAULT_IOS_BUNDLE_IDENTIFIER) => {
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    throw new Error('IOS_TEAM_ID must be the 10-character Apple Developer Team ID.');
  }
  validateBundleIdentifier(bundleId, 'IOS_BUNDLE_IDENTIFIER');
  return {
    applinks: {
      apps: [],
      details: [{
        appIDs: [`${teamId}.${bundleId}`],
        components: appLinkPaths.map((route) => ({ '/': route }))
      }]
    }
  };
};

export const buildAndroidAssociation = (
  fingerprints,
  packageName = DEFAULT_ANDROID_APPLICATION_ID
) => {
  validateBundleIdentifier(packageName, 'ANDROID_APPLICATION_ID');
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: parseAndroidFingerprints(fingerprints)
    }
  }];
};

export const releaseAssociationIdentity = (environment = process.env) => ({
  teamId: environment.IOS_TEAM_ID ?? '',
  iosBundleId: environment.IOS_BUNDLE_IDENTIFIER ?? DEFAULT_IOS_BUNDLE_IDENTIFIER,
  androidApplicationId: environment.ANDROID_APPLICATION_ID ?? DEFAULT_ANDROID_APPLICATION_ID,
  androidFingerprints: environment.ANDROID_SHA256_CERT_FINGERPRINTS ?? ''
});

export const writeAssociationFiles = async (outputDirectory, identity = releaseAssociationIdentity()) => {
  const apple = buildAppleAssociation(identity.teamId, identity.iosBundleId);
  const android = buildAndroidAssociation(identity.androidFingerprints, identity.androidApplicationId);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'apple-app-site-association'), `${JSON.stringify(apple, null, 2)}\n`),
    writeFile(path.join(outputDirectory, 'assetlinks.json'), `${JSON.stringify(android, null, 2)}\n`)
  ]);
  return { apple, android };
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const outputDirectory = path.resolve(process.env.ASSOCIATION_OUTPUT_DIRECTORY ?? 'public/.well-known');
  await writeAssociationFiles(outputDirectory);
  process.stdout.write(`Association files generated in ${outputDirectory}\n`);
}
