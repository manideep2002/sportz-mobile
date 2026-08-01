const appConfig = require('../../app.config.js').expo;
const easConfig = require('../../eas.json');

describe('Expo native/update configuration', () => {
  const locationPlugin = appConfig.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-location'
  ) as [string, Record<string, unknown>];

  it('uses fingerprint runtime compatibility with separate preview and production channels', () => {
    expect(appConfig.runtimeVersion).toEqual({ policy: 'fingerprint' });
    expect(easConfig.build.preview.channel).toBe('preview');
    expect(easConfig.build.production.channel).toBe('production');
  });

  it('requests foreground location only and declares no iOS Always/background location capability', () => {
    expect(appConfig.ios.infoPlist.NSLocationWhenInUseUsageDescription).toContain('nearby courts');
    expect(appConfig.ios.infoPlist.NSLocationAlwaysUsageDescription).toBeUndefined();
    expect(appConfig.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
    expect(locationPlugin[1]).toMatchObject({
      locationWhenInUsePermission: expect.any(String),
      locationAlwaysAndWhenInUsePermission: false,
      locationAlwaysPermission: false,
      isIosBackgroundLocationEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
      isAndroidForegroundServiceEnabled: false
    });
    expect(appConfig.android.permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');
  });
});
