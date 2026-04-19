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
          headerStyle: { backgroundColor: t.bgSurface },
          headerTintColor: t.accentBlue,
          headerTitleStyle: { fontWeight: '600', fontSize: 17, color: t.textPrimary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bgPrimary },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="folders"
          options={{
            title: 'Folders',
            headerLargeTitle: true,
            headerLargeTitleStyle: { fontWeight: '700', color: t.textPrimary },
            headerStyle: { backgroundColor: t.bgSurface },
            contentStyle: { backgroundColor: t.bgPrimary },
          }}
        />
        <Stack.Screen
          name="sermons"
          options={{
            headerLargeTitle: true,
            headerStyle: { backgroundColor: t.bgSurface },
            contentStyle: { backgroundColor: t.bgPrimary },
          }}
        />
        <Stack.Screen
          name="record"
          options={{
            title: 'New Recording',
            headerStyle: { backgroundColor: t.bgSurface },
            headerTintColor: t.accentBlue,
            headerTitleStyle: { fontWeight: '600', fontSize: 17, color: t.textPrimary },
            contentStyle: { backgroundColor: t.bgPrimary },
          }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', presentation: 'modal' }}
        />
        <Stack.Screen
          name="sermon/[id]"
          options={{ title: '' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
