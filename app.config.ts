import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Scribe',
  slug: 'scribe',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'scribe',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F2F2F7',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.scribe.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Scribe needs microphone access to record sermons for transcription and outlining.',
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: 'com.scribe.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A84FF',
    },
    permissions: ['RECORD_AUDIO', 'FOREGROUND_SERVICE', 'WAKE_LOCK'],
  },
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID ?? ''}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  plugins: [
    'expo-router',
    [
      'expo-av',
      {
        microphonePermission:
          'Scribe needs microphone access to record sermons for transcription and outlining.',
      },
    ],
    'expo-secure-store',
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? '',
        project: process.env.SENTRY_PROJECT ?? '',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    apiBibleKey: process.env.API_BIBLE_KEY ?? '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
