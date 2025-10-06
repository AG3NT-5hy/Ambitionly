import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { initSentry } from "@/lib/error-reporting";
import { analytics } from "@/lib/analytics";
import { StyleSheet, Platform, Dimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { UiProvider, UiLayer } from "@/providers/UiProvider";
import { AmbitionProvider } from "@/hooks/ambition-store";
import { SubscriptionProvider } from "@/hooks/subscription-store";
import { UserProvider } from "@/hooks/user-store";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trpc, trpcClient } from "@/lib/trpc";

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
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const prepare = async () => {
      try {
        initSentry();
        analytics.trackAppOpened();
      } catch (error) {
        console.warn('Error during app preparation:', error);
      } finally {
        if (isMounted) {
          setIsReady(true);
          // Hide splash screen after state update
          setTimeout(async () => {
            try {
              await SplashScreen.hideAsync();
            } catch (error) {
              console.warn('Failed to hide splash screen:', error);
            }
          }, 50);
        }
      }
    };
    
    prepare();
    
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <UiProvider>
              <UserProvider>
                <SubscriptionProvider>
                  <AmbitionProvider>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                    <UiLayer />
                  </AmbitionProvider>
                </SubscriptionProvider>
              </UserProvider>
            </UiProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}