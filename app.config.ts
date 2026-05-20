import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Sermonize',
  slug: 'sermonize',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'sermonize',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F1F3F5',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.sermonize.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Sermonize needs microphone access to record sermons for transcription and outlining.',
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: 'com.sermonize.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A84FF',
    },
    permissions: ['RECORD_AUDIO', 'FOREGROUND_SERVICE', 'WAKE_LOCK'],
  },
  plugins: [
    'expo-router',
    [
      'expo-av',
      {
        microphonePermission:
          'Sermonize needs microphone access to record sermons for transcription and outlining.',
      },
    ],
    'expo-secure-store',
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
