import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const t = useTheme();

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bgPrimary },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="folders" />
        <Stack.Screen name="sermons" />
        <Stack.Screen name="record" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sermon/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
