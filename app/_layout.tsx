import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#F2F2F7' },
          headerTintColor: '#000000',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#F2F2F7' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Sermonize',
            headerLargeTitle: true,
            headerLargeTitleStyle: { fontWeight: '700', color: '#000000' },
          }}
        />
        <Stack.Screen
          name="record"
          options={{
            title: 'New Recording',
            headerStyle: { backgroundColor: '#000000' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '600', fontSize: 17, color: '#FFFFFF' },
            contentStyle: { backgroundColor: '#000000' },
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
