import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Image, useWindowDimensions, Animated, AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAmbition } from '../hooks/ambition-store';
import { useUnifiedUser } from '../lib/unified-user-store';

export default function SplashScreen() {
  const ambitionData = useAmbition();
  const { user, isRegistered, isHydrated: userHydrated } = useUnifiedUser();
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasNavigatedRef = useRef(false);
  const segments = useSegments();
  
  // Safely destructure with fallbacks
  const goal = ambitionData?.goal || '';
  const roadmap = ambitionData?.roadmap || null;
  const isHydrated = ambitionData?.isHydrated || false;
  
  // Check if user is premium
  const isPremium = user && 
                    !user.isGuest &&
                    user.subscriptionPlan && 
                    user.subscriptionPlan !== 'free' &&
                    user.subscriptionStatus === 'active' &&
                    (!user.subscriptionExpiresAt || user.subscriptionExpiresAt > new Date());
  
  // Track if we're already on a valid route (not the splash screen)
  // segments will be empty array for index route, or ['(main)', 'roadmap'] etc for other routes
  // Check if we're on a route other than the index/splash screen
  const isOnValidRoute = segments.length > 0 && segments[0] && typeof segments[0] === 'string' && segments[0] !== '';

  const { width } = useWindowDimensions();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  
  // Local logo asset
  const logoSource = require('../assets/images/logo-main.png');

  useEffect(() => {
    // Start background animation
    const backgroundAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    );
    backgroundAnimation.start();

    // Logo fade animation
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Local asset loads immediately, no prefetch needed
      setImageLoaded(true);
    
    return () => {
      backgroundAnimation.stop();
    };
  }, [animatedValue, fadeValue]);

  // Listen for sign-out events to reset navigation state
  useEffect(() => {
    const resetNavigation = () => {
      console.log('[Splash] Sign-out detected, resetting navigation state');
      hasNavigatedRef.current = false;
    };

    const subscription = DeviceEventEmitter.addListener('user-signed-out', resetNavigation);

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle app state changes - prevent navigation when app returns from background if already on valid route
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isOnValidRoute && hasNavigatedRef.current) {
        console.log('[Splash] App returned to foreground, already on valid route:', segments);
        // Don't navigate if we're already on a valid route
        // This prevents the navigation logic from re-running and causing hangs
        return;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isOnValidRoute, segments]);

  useEffect(() => {
    // Don't navigate if already on a valid route (app returned from background)
    if (isOnValidRoute && hasNavigatedRef.current) {
      console.log('[Splash] Already on valid route, skipping navigation');
      return;
    }
    
    // Wait for both stores to be fully hydrated
    if (!imageLoaded || !isHydrated || !userHydrated) {
      console.log('[Splash] Waiting for hydration:', { imageLoaded, isHydrated, userHydrated });
      return;
    }
    
    // Prevent multiple navigations
    if (hasNavigatedRef.current) {
      console.log('[Splash] Already navigated, skipping');
      return;
    }

    // Check if app is active before navigating (prevents hangs when resuming)
    if (AppState.currentState !== 'active') {
      console.log('[Splash] App not active, deferring navigation');
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        // Check AsyncStorage directly to avoid stale in-memory state
        const { STORAGE_KEYS } = await import('../constants');
        const storedGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL);
        const storedRoadmap = await AsyncStorage.getItem(STORAGE_KEYS.ROADMAP);
        
        // Also check if user is a guest (after sign-out, user should be guest)
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        let isGuestUser = true;
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            isGuestUser = userData.isGuest === true;
          } catch (e) {
            // If we can't parse, assume guest
          }
        }
        
        // Parse roadmap if it exists
        let parsedRoadmap = null;
        if (storedRoadmap) {
          try {
            parsedRoadmap = JSON.parse(storedRoadmap);
          } catch (e) {
            console.warn('Failed to parse stored roadmap:', e);
          }
        }
        
        // Check if user is registered (not guest) by checking Supabase session
        let isRegisteredUser = !isGuestUser;
        let session = null;
        if (isGuestUser) {
          // Double-check by looking at Supabase session
          try {
            const { supabase } = await import('../lib/supabase');
            const { data: { session: supabaseSession } } = await supabase.auth.getSession();
            session = supabaseSession;
            if (session?.user) {
              console.log('[Splash] Supabase session found, user is registered');
              isRegisteredUser = true;
            }
          } catch (e) {
            console.warn('[Splash] Error checking Supabase session:', e);
          }
        } else {
          // If not a guest, also check Supabase session to be sure
          try {
            const { supabase } = await import('../lib/supabase');
            const { data: { session: supabaseSession } } = await supabase.auth.getSession();
            session = supabaseSession;
            if (session?.user) {
              console.log('[Splash] Confirmed registered user with Supabase session');
            }
          } catch (e) {
            console.warn('[Splash] Error checking Supabase session:', e);
          }
        }
        
        // Navigate to roadmap if we have both goal and roadmap in storage
        // This works for both guest users and registered users
        // Guest users should be able to access their saved roadmap
        if (storedGoal && parsedRoadmap && typeof storedGoal === 'string' && typeof parsedRoadmap === 'object' && parsedRoadmap.phases) {
          console.log('[Splash] Existing goal and roadmap found in storage, navigating to roadmap');
          console.log('[Splash] User status:', {
            isGuestUser,
            isRegisteredUser,
            hasSupabaseSession: !!session?.user,
            hasGoal: !!storedGoal,
            hasRoadmap: !!parsedRoadmap,
            goalLength: storedGoal?.length || 0,
            roadmapPhases: parsedRoadmap?.phases?.length || 0,
          });
          hasNavigatedRef.current = true;
          router.replace('/(main)/roadmap');
        } else {
          // If user has no roadmap, show welcome screen
          // Registered users stay logged in, guests can start fresh
          if (isRegisteredUser) {
            console.log('[Splash] Registered user with no roadmap, navigating to welcome (staying logged in)');
            console.log('[Splash] User data:', {
              hasGoal: !!storedGoal,
              hasRoadmap: !!parsedRoadmap,
              goalLength: storedGoal?.length || 0,
              roadmapPhases: parsedRoadmap?.phases?.length || 0,
            });
          } else {
            console.log('[Splash] No existing goal/roadmap in storage, navigating to welcome');
            console.log('[Splash] User status:', {
              isGuestUser,
              isRegisteredUser,
              hasSupabaseSession: !!session?.user,
              hasGoal: !!storedGoal,
              hasRoadmap: !!parsedRoadmap,
            });
          }
          hasNavigatedRef.current = true;
          router.replace('/welcome');
        }
      } catch (error) {
        console.error('[Splash] Navigation error:', error);
        // Fallback navigation
        hasNavigatedRef.current = true;
        router.replace('/welcome');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [imageLoaded, isHydrated, userHydrated, isPremium, isOnValidRoute]);

  // Show loading state until hydrated or if ambition data is not available
  if (!isHydrated || !ambitionData) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#29202B', '#000000']}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFillObject]}>
        <LinearGradient
          colors={['#000000', '#29202B', '#000000']}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View 
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.3, 0]
              })
            }
          ]}
        >
          <LinearGradient
            colors={['#1a0a1f', '#3d2a42', '#1a0a1f']}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.content}>
        <View style={styles.logoContainer} accessibilityLabel="App logo">
          <Animated.View 
            style={[
              styles.logoImageContainer, 
              { 
                width: width * 0.8, 
                height: width * 0.8,
                opacity: fadeValue
              }
            ]}
          >
            {imageLoaded && (
              <Image
                source={logoSource}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="Ambitionly logo"
              />
            )}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginTop: -120,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
