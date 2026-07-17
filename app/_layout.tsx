import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/auth';
import { RecordingBar } from '@/components/RecordingBar';
import { logCrash, logEvent } from '@/services/logger';
import { purgeExpiredDeleted, recoverOrphanedAudio } from '@/storage/sermons';
import { useTheme } from '@/theme';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => { void logCrash(error, { source: 'ErrorBoundary' }); }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20 }}>{error.message}</Text>
      <TouchableOpacity onPress={retry} style={{ backgroundColor: '#0A84FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function RootLayout() {
  const t = useTheme();

  useEffect(() => {
    void (async () => {
      const recovered = await recoverOrphanedAudio().catch(() => [] as string[]);
      if (recovered.length > 0) {
        void logEvent('orphaned_audio_recovered', { count: recovered.length });
      }
      await purgeExpiredDeleted().catch(() => undefined);
    })();
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: t.bgPrimary },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="folders" />
          <Stack.Screen name="sermons" />
          <Stack.Screen name="record" />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sermon/[id]" />
        </Stack>
        {/* Persistent recording indicator shown on every screen except record */}
        <RecordingBar />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

export default RootLayout;
