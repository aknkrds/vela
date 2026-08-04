import { Stack } from 'expo-router';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/src/contexts/SettingsContext';
import { PinLockOverlay } from '@/src/components/PinLockOverlay';
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        // Prewarm icon assets for Android Expo Go
        await Asset.loadAsync([
          require('@/assets/images/app-image.png'),
        ]);
      } catch (e) {
        console.warn('Error prewarming assets', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent={true} />
      <SettingsProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(auth)/register" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <PinLockOverlay />
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
