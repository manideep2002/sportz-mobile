require('dotenv').config({ path: '.env', debug: false, quiet: true });

const canonicalWebUrl = process.env.EXPO_PUBLIC_CANONICAL_WEB_URL || 'https://sportz.app';
const canonicalUrl = new URL(canonicalWebUrl);
if (canonicalUrl.protocol !== 'https:') {
  throw new Error('EXPO_PUBLIC_CANONICAL_WEB_URL must use HTTPS for Universal Links and Android App Links.');
}
const canonicalHost = canonicalUrl.hostname;
const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || 'com.sportz.mobile';
const androidApplicationId = process.env.ANDROID_APPLICATION_ID || 'com.sportz.mobile';
const applicationIdentifierPattern = /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)+$/;
if (!applicationIdentifierPattern.test(iosBundleIdentifier) || !applicationIdentifierPattern.test(androidApplicationId)) {
  throw new Error('IOS_BUNDLE_IDENTIFIER and ANDROID_APPLICATION_ID must be valid reverse-DNS identifiers.');
}
const appLinkPathPrefixes = [
  '/posts',
  '/profiles',
  '/events',
  '/courts',
  '/groups',
  '/pages',
  '/invitations/community',
  '/booking',
  '/offer',
  '/reset-password'
];

module.exports = {
  expo: {
    name: 'SPORTZ',
    slug: 'sportz',
    scheme: 'sportz',
    version: '1.0.0',
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      usesAppleSignIn: true,
      associatedDomains: [`applinks:${canonicalHost}`],
      infoPlist: {
        NSCameraUsageDescription: 'SPORTZ uses your camera to add profile photos, stories, posts, and event media.',
        NSMicrophoneUsageDescription: 'SPORTZ uses your microphone to record audio with camera-captured videos.',
        NSPhotoLibraryUsageDescription: 'SPORTZ lets you choose media for posts, stories, profiles, and event covers.',
        NSLocationWhenInUseUsageDescription: 'SPORTZ uses location to show nearby courts and local events.'
      }
    },
    android: {
      package: androidApplicationId,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: appLinkPathPrefixes.map((pathPrefix) => ({ scheme: 'https', host: canonicalHost, pathPrefix })),
          category: ['BROWSABLE', 'DEFAULT']
        }
      ],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0907'
      },
      permissions: [
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'POST_NOTIFICATIONS'
      ]
    },
    plugins: [
      'expo-apple-authentication',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'SPORTZ uses location to show nearby courts and local events.',
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false
        }
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          imageWidth: 390,
          resizeMode: 'contain',
          backgroundColor: '#0A0907',
          dark: {
            image: './assets/splash.png',
            backgroundColor: '#0A0907'
          }
        }
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF5A1F',
          sounds: []
        }
      ],
      './plugins/with-android-release-signing',
      '@react-native-community/datetimepicker',
      '@sentry/react-native/expo'
    ],
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png'
    },
    extra: {
      eas: {
        projectId: '2961c035-fb1f-4581-8f72-798e998d175a'
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME,
      EXPO_PUBLIC_CANONICAL_WEB_URL: canonicalWebUrl,
      EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
      EXPO_PUBLIC_SUPPORT_URL: process.env.EXPO_PUBLIC_SUPPORT_URL,
      EXPO_PUBLIC_APP_STORE_URL: process.env.EXPO_PUBLIC_APP_STORE_URL,
      EXPO_PUBLIC_PLAY_STORE_URL: process.env.EXPO_PUBLIC_PLAY_STORE_URL,
      EXPO_PUBLIC_INSTALL_FALLBACK_URL: process.env.EXPO_PUBLIC_INSTALL_FALLBACK_URL,
      EXPO_PUBLIC_MAP_PROVIDER: process.env.EXPO_PUBLIC_MAP_PROVIDER,
      EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
      EXPO_PUBLIC_ENABLE_DEV_MONITORING: process.env.EXPO_PUBLIC_ENABLE_DEV_MONITORING
    },
    updates: {
      url: 'https://u.expo.dev/2961c035-fb1f-4581-8f72-798e998d175a'
    },
    runtimeVersion: {
      policy: 'fingerprint'
    }
  }
};
