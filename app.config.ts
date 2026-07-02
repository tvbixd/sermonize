import type { ExpoConfig, ConfigContext } from 'expo/config';

const EAS_PROJECT_ID = '8ccfc5d3-c6d1-4c67-bd3b-0306b737cae2';

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
      // Standard HTTPS only — skips the export-compliance question on
      // every TestFlight upload.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.scribe.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A84FF',
    },
    permissions: [
      'RECORD_AUDIO',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MICROPHONE',
      'WAKE_LOCK',
    ],
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-av',
      {
        microphonePermission:
          'Scribe needs microphone access to record sermons for transcription and outlining.',
      },
    ],
    'expo-secure-store',
  ],
  experiments: {
    tsconfigPaths: true,
  },
  extra: {
    apiBibleKey: process.env.API_BIBLE_KEY ?? '',
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
});
