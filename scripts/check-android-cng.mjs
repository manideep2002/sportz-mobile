import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const variant = process.argv.includes('--variant')
  ? process.argv[process.argv.indexOf('--variant') + 1]
  : undefined;

if (variant && !['debug', 'release'].includes(variant)) {
  throw new Error('Use --variant debug or --variant release.');
}

const readGeneratedFile = (relativePath) => {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) throw new Error(`${relativePath} is missing. Run npm run android:generate first.`);
  return readFileSync(file, 'utf8');
};

const expoConfig = JSON.parse(execFileSync(
  process.execPath,
  [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'config', '--type', 'public', '--json'],
  { cwd: root, encoding: 'utf8', env: process.env }
));
const packageName = expoConfig.android?.package;
const updateUrl = expoConfig.updates?.url;
if (!packageName || !updateUrl) throw new Error('Expo config must define android.package and updates.url.');

const appBuildGradle = readGeneratedFile('android/app/build.gradle');
const manifest = readGeneratedFile('android/app/src/main/AndroidManifest.xml');
const rootBuildGradle = readGeneratedFile('android/build.gradle');

const expectedPermissions = expoConfig.android?.permissions ?? [];
const expectedPathPrefixes = (expoConfig.android?.intentFilters ?? [])
  .flatMap((filter) => filter.data ?? [])
  .map((data) => data.pathPrefix)
  .filter(Boolean);

const mustContain = (contents, value, file) => {
  if (!contents.includes(value)) throw new Error(`${file} does not contain generated value: ${value}`);
};
const mustMatch = (contents, expression, file) => {
  if (!expression.test(contents)) throw new Error(`${file} does not contain expected generated configuration.`);
};

mustMatch(appBuildGradle, new RegExp(`namespace\\s+['\"]${packageName}['\"]`), 'android/app/build.gradle');
mustMatch(appBuildGradle, new RegExp(`applicationId\\s+['\"]${packageName}['\"]`), 'android/app/build.gradle');
mustContain(manifest, updateUrl, 'android/app/src/main/AndroidManifest.xml');
mustContain(manifest, 'expo.modules.updates.EXPO_RUNTIME_VERSION', 'android/app/src/main/AndroidManifest.xml');
mustContain(rootBuildGradle, 'expo-root-project', 'android/build.gradle');
mustContain(appBuildGradle, 'compileSdk rootProject.ext.compileSdkVersion', 'android/app/build.gradle');

for (const permission of expectedPermissions) {
  const permissionName = permission.startsWith('android.permission.') ? permission : `android.permission.${permission}`;
  mustContain(manifest, permissionName, 'android/app/src/main/AndroidManifest.xml');
}
for (const pathPrefix of expectedPathPrefixes) {
  mustContain(manifest, `android:pathPrefix=\"${pathPrefix}\"`, 'android/app/src/main/AndroidManifest.xml');
}

const releaseBlock = appBuildGradle.match(/buildTypes\s*\{[\s\S]*?release\s*\{([\s\S]*?)^[ \t]{8}\}/m)?.[1] ?? '';
if (!releaseBlock.includes('signingConfig signingConfigs.release') || releaseBlock.includes('signingConfigs.debug')) {
  throw new Error('The generated release build must use signingConfigs.release and never the debug keystore.');
}
mustContain(appBuildGradle, "findProperty('SPORTZ_RELEASE_STORE_FILE')", 'android/app/build.gradle');

if (variant === 'debug') {
  const debugBlock = appBuildGradle.match(/buildTypes\s*\{[\s\S]*?debug\s*\{([\s\S]*?)^[ \t]{8}\}/m)?.[1] ?? '';
  if (!debugBlock.includes('signingConfig signingConfigs.debug')) {
    throw new Error('The generated debug build must use the debug signing configuration.');
  }
}

process.stdout.write(`Android CNG ${variant ?? 'configuration'} check passed for ${packageName}.\n`);
