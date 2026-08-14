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
    bundleIdentifier: 'com.breakandbuild.scribe',
    // Informational only. eas.json uses appVersionSource:"remote" +
    // autoIncrement, so EAS assigns the real buildNumber/versionCode on its
    // servers and bumps them every production build. If Play ever rejects a
    // duplicate, run `eas build:version:set` to raise the remote counter.
    buildNumber: '1',
    // iOS 26 Liquid Glass icon from Apple's Icon Composer (SDK 54+). Overrides
    // the top-level PNG on iOS; Android still uses the adaptiveIcon PNG below.
    icon: './assets/Scribe.icon',
    // On-device Whisper loads a large model — these let it use the memory it
    // needs instead of being killed mid-inference.
    entitlements: {
      'com.apple.developer.kernel.increased-memory-limit': true,
      'com.apple.developer.kernel.extended-virtual-addressing': true,
    },
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
    package: 'com.breakandbuild.scribe',
    versionCode: 1,
    adaptiveIcon: {
      // Foreground art is the blue book mark — the background must NOT also
      // be blue or the icon renders as a solid blue square.
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    // No FOREGROUND_SERVICE* here: expo-av runs no foreground service, and
    // declaring the permission without one risks Play Store rejection. Android
    // recording is foreground-only for now (see BACKGROUND_RECORDING.md).
    permissions: [
      'RECORD_AUDIO',
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
    [
      'expo-image-picker',
      {
        photosPermission: 'Scribe uses your photos so you can set a profile picture.',
      },
    ],
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
