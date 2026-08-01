import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const appConfig = require('../../app.config.js').expo;
const generator = path.resolve(process.cwd(), 'scripts/generate-association-files.mjs');
const validator = path.resolve(process.cwd(), 'scripts/validate-association-files.mjs');
const fingerprint = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
const expectedPrefixes = [
  '/posts', '/profiles', '/events', '/courts', '/groups', '/pages',
  '/invitations/community', '/booking', '/offer', '/reset-password'
];

describe('iOS Universal Links and Android App Links', () => {
  it('configures the HTTPS host and every linked native route', () => {
    expect(appConfig.ios.associatedDomains).toEqual(['applinks:sportz.app']);
    expect(appConfig.ios.bundleIdentifier).toBe('com.sportz.mobile');
    expect(appConfig.android.package).toBe('com.sportz.mobile');
    const filter = appConfig.android.intentFilters.find((item: { autoVerify?: boolean }) => item.autoVerify);
    expect(filter).toBeDefined();
    expect(filter.data.map((item: { pathPrefix: string }) => item.pathPrefix)).toEqual(
      expect.arrayContaining(expectedPrefixes)
    );
  });

  it('generates identity-bound association files and validates them before deployment', () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'sportz-links-'));
    const env = {
      ...process.env,
      ASSOCIATION_OUTPUT_DIRECTORY: output,
      IOS_TEAM_ID: 'ABCDE12345',
      IOS_BUNDLE_IDENTIFIER: 'com.sportz.mobile',
      ANDROID_APPLICATION_ID: 'com.sportz.mobile',
      ANDROID_SHA256_CERT_FINGERPRINTS: fingerprint
    };
    try {
      execFileSync(process.execPath, [generator], { cwd: process.cwd(), env });
      execFileSync(process.execPath, [validator], { cwd: process.cwd(), env });
      const apple = JSON.parse(fs.readFileSync(path.join(output, 'apple-app-site-association'), 'utf8'));
      const android = JSON.parse(fs.readFileSync(path.join(output, 'assetlinks.json'), 'utf8'));

      expect(apple.applinks.details[0].appIDs).toEqual(['ABCDE12345.com.sportz.mobile']);
      expect(apple.applinks.details[0].components).toEqual(
        expectedPrefixes.map((prefix) => ({ '/': prefix === '/reset-password' ? prefix : `${prefix}/*` }))
      );
      expect(android[0].target).toMatchObject({
        namespace: 'android_app',
        package_name: 'com.sportz.mobile',
        sha256_cert_fingerprints: [fingerprint]
      });
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });

  it('does not retain deployable placeholder association files in source control', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/.well-known/apple-app-site-association'))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/.well-known/assetlinks.json'))).toBe(false);
  });

  it('refuses generation without a real Apple Team ID and production signing fingerprint', () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'sportz-links-missing-'));
    try {
      expect(() => execFileSync(process.execPath, [generator], {
        cwd: process.cwd(),
        env: { ...process.env, ASSOCIATION_OUTPUT_DIRECTORY: output, IOS_TEAM_ID: '', ANDROID_SHA256_CERT_FINGERPRINTS: '' },
        stdio: 'pipe'
      })).toThrow('IOS_TEAM_ID must be the 10-character Apple Developer Team ID.');
      expect(() => execFileSync(process.execPath, [generator], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ASSOCIATION_OUTPUT_DIRECTORY: output,
          IOS_TEAM_ID: 'ABCDE12345',
          ANDROID_SHA256_CERT_FINGERPRINTS: 'not-a-fingerprint'
        },
        stdio: 'pipe'
      })).toThrow('ANDROID_SHA256_CERT_FINGERPRINTS must contain production SHA-256 fingerprints.');
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });
});
