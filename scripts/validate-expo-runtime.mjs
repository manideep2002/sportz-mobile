import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const node = process.execPath;
const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
const updatesCli = path.join(root, 'node_modules', 'expo-updates', 'bin', 'cli.js');

const run = (script, args) => execFileSync(node, [script, ...args], {
  cwd: root,
  encoding: 'utf8',
  env: process.env
}).trim();

const config = JSON.parse(run(expoCli, ['config', '--type', 'public', '--json']));
if (config.runtimeVersion?.policy !== 'fingerprint') {
  throw new Error('Expo runtimeVersion must use the fingerprint policy.');
}
if (!config.updates?.url) {
  throw new Error('Expo updates.url must be configured.');
}

const locationPlugin = config.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location'
);
const locationOptions = locationPlugin?.[1];
if (
  !locationOptions ||
  typeof locationOptions.locationWhenInUsePermission !== 'string' ||
  locationOptions.locationAlwaysAndWhenInUsePermission !== false ||
  locationOptions.locationAlwaysPermission !== false ||
  locationOptions.isIosBackgroundLocationEnabled !== false ||
  locationOptions.isAndroidBackgroundLocationEnabled !== false ||
  locationOptions.isAndroidForegroundServiceEnabled !== false ||
  config.ios?.infoPlist?.NSLocationAlwaysUsageDescription ||
  config.ios?.infoPlist?.NSLocationAlwaysAndWhenInUseUsageDescription ||
  config.android?.permissions?.includes('ACCESS_BACKGROUND_LOCATION')
) {
  throw new Error('Expo location configuration must remain foreground-only.');
}

for (const platform of ['ios', 'android']) {
  const result = JSON.parse(run(updatesCli, ['runtimeversion:resolve', '--platform', platform]));
  if (typeof result.runtimeVersion !== 'string' || !result.runtimeVersion) {
    throw new Error(`Could not resolve a fingerprint runtime version for ${platform}.`);
  }
  process.stdout.write(`${platform} fingerprint runtime: ${result.runtimeVersion}\n`);
}

process.stdout.write('Expo fingerprint runtime configuration check passed.\n');
