require('dotenv').config({ path: '.env', debug: false, quiet: true });

module.exports = {
  expo: {
    name: 'SPORTZ',
    slug: 'sportz',
    scheme: 'sportz',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.sportz.mobile',
      usesAppleSignIn: true,
      infoPlist: {
        NSCameraUsageDescription: 'SPORTZ uses your camera to add profile photos, stories, posts, and event media.',
        NSPhotoLibraryUsageDescription: 'SPORTZ lets you choose media for posts, stories, profiles, and event covers.',
        NSLocationWhenInUseUsageDescription: 'SPORTZ uses location to show nearby courts and local events.'
      }
    },
    android: {
      package: 'com.sportz.mobile',
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
          locationAlwaysAndWhenInUsePermission: 'SPORTZ uses location to recommend courts and events near you.'
        }
      ],
      [
        'expo-notifications',
        {
          color: '#FF5A1F',
          sounds: []
        }
      ],
      '@react-native-community/datetimepicker'
    ],
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
      EXPO_PUBLIC_MAP_PROVIDER: process.env.EXPO_PUBLIC_MAP_PROVIDER
    },
    updates: {
      url: 'https://u.expo.dev/2961c035-fb1f-4581-8f72-798e998d175a'
    },
    runtimeVersion: {
      policy: 'appVersion'
    }
  }
};
