import { ErrorBoundary } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/auth';
import { useTheme } from '@/theme';

export { ErrorBoundary };

function RootLayout() {
  const t = useTheme();

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
      </SafeAreaProvider>
    </AuthProvider>
  );
}

export default RootLayout;
