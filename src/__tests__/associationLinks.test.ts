import fs from 'node:fs';
import path from 'node:path';

const appConfig = require('../../app.config.js').expo;
const appleAssociation = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), 'public/.well-known/apple-app-site-association'),
  'utf8'
));
const androidAssociation = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), 'public/.well-known/assetlinks.json'),
  'utf8'
));
const generator = fs.readFileSync(
  path.resolve(process.cwd(), 'scripts/generate-association-files.mjs'),
  'utf8'
);

describe('iOS and Android app-link association configuration', () => {
  it('configures the HTTPS host for iOS and every canonical Android route', () => {
    expect(appConfig.ios.associatedDomains).toEqual(['applinks:sportz.app']);
    const filter = appConfig.android.intentFilters.find((item: { autoVerify?: boolean }) => item.autoVerify);
    expect(filter).toBeDefined();
    expect(filter.data.map((item: { pathPrefix: string }) => item.pathPrefix)).toEqual(
      expect.arrayContaining([
        '/posts',
        '/profiles',
        '/events',
        '/courts',
        '/groups',
        '/pages',
        '/invitations/community'
      ])
    );
  });

  it('ships deployable endpoint files with matching package and bundle identifiers', () => {
    expect(appleAssociation.applinks.details[0].appIDs[0]).toContain('.com.sportz.mobile');
    expect(androidAssociation[0].target.package_name).toBe('com.sportz.mobile');
    expect(androidAssociation[0].relation).toContain('delegate_permission/common.handle_all_urls');
  });

  it('requires real production signing identifiers before association deployment', () => {
    expect(generator).toContain('IOS_TEAM_ID must be the 10-character Apple Developer Team ID.');
    expect(generator).toContain('ANDROID_SHA256_CERT_FINGERPRINTS must contain production SHA-256 fingerprints.');
    expect(generator).toMatch(/fingerprintPattern/);
  });
});

