import type { ExpoConfig, ConfigContext } from 'expo/config';

const EAS_PROJECT_ID = '8ccfc5d3-c6d1-4c67-bd3b-0306b737cae2';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Scribe',
  slug: 'scribe',
  version: '1.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'scribe',
  icon: './assets/icon.png',
  ios: {
    // iPhone-only for v1 — avoids the App Store iPad screenshot requirement and
    // matches the phone-first design. Revisit if iPad support is added later.
    supportsTablet: false,
    bundleIdentifier: 'com.breakandbuild.scribe',
    // Informational only. eas.json uses appVersionSource:"remote" +
    // autoIncrement, so EAS assigns the real buildNumber/versionCode on its
    // servers and bumps them every production build. If Play ever rejects a
    // duplicate, run `eas build:version:set` to raise the remote counter.
    buildNumber: '1',
    // iOS 26 Liquid Glass icon from Apple's Icon Composer (SDK 54+). Overrides
    // the top-level PNG on iOS; Android still uses the adaptiveIcon PNG below.
    icon: './assets/Scribe.icon',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Scribe needs microphone access to record sermons for transcription and outlining.',
      // Enables recording to continue while backgrounded / screen-locked on iOS
      // (paired with setAudioModeAsync shouldPlayInBackground in SermonRecorder).
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
    // Recording is foreground-only on Android for v1 (iOS records while
    // backgrounded/locked via UIBackgroundModes above). We deliberately do NOT
    // add a MICROPHONE foreground service, so true Android background *recording*
    // is deferred (see BACKGROUND_RECORDING_SCOPE.md). Note: the expo-audio
    // plugin still injects FOREGROUND_SERVICE + FOREGROUND_SERVICE_MEDIA_PLAYBACK
    // (for background audio *playback*), which requires a Play Console
    // foreground-service declaration at submission. WAKE_LOCK + expo-keep-awake
    // hold the screen on while Scribe is open.
    permissions: [
      'RECORD_AUDIO',
      'WAKE_LOCK',
    ],
  },
  // Skip the EAS Update association when testing in Expo Go (set EXPO_GO=1),
  // otherwise Expo Go forces an account auth handshake to open the project.
  // Production/EAS builds keep OTA updates as normal.
  ...(process.env.EXPO_GO
    ? {}
    : {
        updates: {
          url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
        },
        runtimeVersion: {
          policy: 'appVersion' as const,
        },
      }),
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#F2F2F7',
      },
    ],
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Scribe uses your photos so you can set a profile picture.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'Scribe needs microphone access to record sermons for transcription and outlining.',
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
