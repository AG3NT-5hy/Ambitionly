import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { initSentry } from "../lib/error-reporting";
import { analytics } from "../lib/analytics";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { UiProvider, UiLayer } from "../providers/UiProvider";
import { AmbitionProvider } from "../hooks/ambition-store";
import { SubscriptionProvider } from "../hooks/subscription-store";
import { UserProvider } from "../hooks/user-store";
import { UnifiedUserProvider } from "../lib/unified-user-store";
import { AuthProvider } from "../hooks/auth-store";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LicenseChecker } from "../components/LicenseChecker";
import { trpc, trpcClient } from "../lib/trpc";
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';
import { useAuthListener } from "../hooks/use-auth-listener";
import { configureGoogleSignIn } from "../lib/google-signin-native";

// RevenueCat Configuration - Disabled for Expo Go compatibility
// Note: RevenueCat requires a development build for full functionality
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  // iOS not configured - app is Android-only
  if (Platform.OS === 'android') {
    try {
      const APIKey = "goog_ADevXcaXkfzYBrgyWGbCXcRsqzh"; // Android/Google Play API key
      
      // Configure RevenueCat SDK for Android
      Purchases.configure({ apiKey: APIKey });
      
      // Set user ID for proper tracking (optional but recommended)
      Purchases.getAppUserID().then((userId) => {
        console.log(`✅ RevenueCat configured successfully for Android`);
        console.log(`📱 Platform: ${Platform.OS}`);
        console.log(`🔑 API Key: ${APIKey.substring(0, 15)}...`);
        console.log(`👤 User ID: ${userId}`);
      }).catch((error) => {
        console.warn('⚠️ Failed to get user ID:', error);
      });
      
      // Enable debug logs in development
      if (__DEV__) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }
    } catch (error) {
      console.error('❌ Failed to configure RevenueCat:', error);
    }
  } else {
    console.log('ℹ️ iOS not supported - app is Android-only');
  }
} else {
  console.log('ℹ️ RevenueCat disabled in Expo Go - requires development build');
}

// Prevent native splash from showing - index.tsx will be the splash screen
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContent: {
    backgroundColor: '#000000',
  },
});

const { width, height } = Dimensions.get('window');

const stackScreenOptions = {
  headerShown: false,
  contentStyle: styles.screenContent,
  ...Platform.select({
    android: {
      // Ensure proper scaling on Android
      gestureEnabled: true,
      animationTypeForReplace: 'push' as const,
    },
  }),
};

function RootLayoutNav() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="questions" />
      <Stack.Screen name="generating" />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="phases" options={{ headerShown: true }} />
      <Stack.Screen name="questions-intro" />
      <Stack.Screen name="questions-new" />
      <Stack.Screen name="dev-settings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = React.useState(true); // Start as ready so index.tsx shows immediately
  
  // Initialize auth listener to handle OAuth callbacks
  useAuthListener();

  useEffect(() => {
    let isMounted = true;
    
    // Hide native splash screen immediately so index.tsx can be the splash screen
    const hideSplash = async () => {
      try {
        // Hide splash immediately before app renders
        await SplashScreen.hideAsync();
        console.log('✅ Native splash screen hidden - showing index.tsx as splash');
      } catch (error) {
        console.warn('⚠️ Failed to hide splash screen immediately:', error);
      }
    };
    
    // Hide splash immediately - this happens synchronously before React renders
    hideSplash();
    
    // Prepare app in background (non-blocking - index.tsx will show immediately)
    const prepare = async () => {
      try {
        initSentry();
        analytics.trackAppOpened();
        
        // Configure Google Sign-In for native authentication
        configureGoogleSignIn();
        
        // Check connections (async, non-blocking)
        import('../constants').then(({ checkConnections }) => {
          checkConnections().then((status) => {
            console.log('🔗 Connection Status:', {
              '✅ Supabase': status.supabase ? 'Connected' : '❌ Not Connected',
              '📊 Database': 'Configured (Prisma client generated)',
              '🔐 License Verification': 'Ready (Play Store check enabled)',
            });
          }).catch((err) => {
            console.warn('⚠️ Connection check failed:', err);
          });
        });
      } catch (error) {
        console.warn('Error during app preparation:', error);
      }
      // No need to set isReady - it's already true
    };
    
    prepare();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <UiProvider>
              <AuthProvider>
                <UnifiedUserProvider>
                  <UserProvider>
                    <SubscriptionProvider>
                      <AmbitionProvider>
                        <LicenseChecker>
                          <StatusBar style="light" />
                          <RootLayoutNav />
                          <UiLayer />
                        </LicenseChecker>
                      </AmbitionProvider>
                    </SubscriptionProvider>
                  </UserProvider>
                </UnifiedUserProvider>
              </AuthProvider>
            </UiProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}