import React, { useEffect, useState } from 'react';
import { Platform, StatusBar as NativeStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import colors from '@/constants/colors';
import * as Font from 'expo-font';
import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { getFirebaseIdToken } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SuccessToastProvider } from '@/components/SuccessToastProvider';
import { LanguageProvider } from '@/lib/i18n';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
if (apiDomain) {
  setBaseUrl(`https://${apiDomain}`);
}
setAuthTokenGetter(getFirebaseIdToken);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const iconFontAssets = {
  ...Feather.font,
  ...FontAwesome.font,
  ...Ionicons.font,
};

const nativeFontAssets = {
  ...iconFontAssets,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

function RootLayoutNav() {
  return (
    <>
      {Platform.OS === 'android' ? (
        <NativeStatusBar
          hidden={false}
          barStyle="light-content"
          {...({ backgroundColor: colors.chrome.statusBar, translucent: false } as any)}
        />
      ) : (
        <StatusBar hidden={false} style="light" />
      )}
      {Platform.OS === 'android' && (
        <NavigationBar hidden={false} style="dark" />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Do not call the Google-font hook on web. Its browser FontFaceObserver can
  // reject after six seconds when the preview iframe blocks font loading,
  // even though this app intentionally uses system fallbacks on web.
  const [fontsLoaded, setFontsLoaded] = useState(Platform.OS === 'web');
  const [fontError, setFontError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const assets = Platform.OS === 'web' ? iconFontAssets : nativeFontAssets;
    Font.loadAsync(assets)
      .then(() => {
        if (mounted) setFontsLoaded(true);
      })
      .catch((error) => {
        if (mounted) {
          setFontError(error instanceof Error ? error : new Error(String(error)));
          setFontsLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // The web preview does not reliably dismiss the native splash overlay.
  // Render with system fallbacks there while native waits for Inter.
  if (!fontsLoaded && !fontError && Platform.OS !== 'web') return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
              <KeyboardProvider>
                <SuccessToastProvider>
                  <RootLayoutNav />
                </SuccessToastProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
