/**
 * Unified User Store
 * Handles both guest users (local storage) and registered users (database)
 */

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import Purchases from 'react-native-purchases';
import { supabase } from './supabase';
import { signInWithGoogleNative } from './google-signin-native';
import { trpc, trpcClient } from './trpc';
import type { AppRouter } from '../backend/trpc/app-router';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import { collectGuestData, clearGuestData, backupGuestData } from './user-data-migration';
import { STORAGE_KEYS } from '../constants';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { config } from '../config';

// Helper to create a fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
};

const createBackendClient = () => {
  const baseUrl = config.API_URL;
  const trpcUrl = `${baseUrl}/api/trpc`;
  console.log('[UnifiedUser] Creating backend client with URL:', trpcUrl);
  
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpLink({
        url: trpcUrl,
        fetch: async (url, options) => {
          try {
            // Check if app is in foreground before making request
            const appState = AppState.currentState;
            if (appState !== 'active') {
              console.warn('[UnifiedUser] App not active, skipping network request');
              throw new Error('App is not in foreground');
            }
            
            console.log('[UnifiedUser] Making request to:', url);
            const startTime = Date.now();
            
            // Use timeout to prevent hanging requests
            const response = await fetchWithTimeout(url, {
              ...options,
              headers: {
                ...options?.headers,
                'Content-Type': 'application/json',
              },
            }, 10000); // 10 second timeout

            const duration = Date.now() - startTime;
            console.log('[UnifiedUser] Request completed:', {
              url,
              status: response.status,
              statusText: response.statusText,
              duration: `${duration}ms`,
            });

            if (!response.ok) {
              console.error('[UnifiedUser] ❌ Request failed:', {
                status: response.status,
                statusText: response.statusText,
                url,
              });
              const errorClone = response.clone();
              const errorText = await errorClone.text().catch(() => 'Unknown error');
              console.error('[UnifiedUser] Error response body:', errorText.substring(0, 500));
            }

            return response;
          } catch (error: any) {
            console.error('[UnifiedUser] ❌ Fetch error:', {
              message: error?.message,
              error,
              url,
              stack: error?.stack,
            });
            throw error;
          }
        },
      }),
    ],
  });
};

export type UserMode = 'guest' | 'registered';

export interface UnifiedUser {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  profilePicture: string | null;
  mode: UserMode;
  isGuest: boolean;
  createdAt: Date;
  
  // Subscription data
  subscriptionPlan: 'free' | 'monthly' | 'annual' | 'lifetime';
  subscriptionStatus: 'active' | 'cancelled' | 'expired' | null;
  subscriptionExpiresAt: Date | null;
  subscriptionPurchasedAt: Date | null;
}

// Generate a unique guest ID
const generateGuestId = () => {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const [UnifiedUserProvider, useUnifiedUser] = createContextHook(() => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [user, setUserInternal] = useState<UnifiedUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasLoadedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const userRef = useRef<UnifiedUser | null>(null);

  // Use tRPC hooks for mutations
  const signupMutation = trpc.auth.signup.useMutation();
  const confirmSupabaseUserMutation = trpc.auth.confirmSupabaseUser.useMutation();
  const createUserMutation = trpc.user.create.useMutation();
  const updateUserMutation = trpc.user.update.useMutation();

  // Keep userRef in sync with user state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Monitor AppState to prevent operations when app is in background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;
      console.log('[UnifiedUser] AppState changed to:', nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Load user on init (only once)
  useEffect(() => {
    // Prevent re-hydration when app resumes from background
    if (hasLoadedRef.current) {
      console.log('[UnifiedUser] Already loaded, skipping re-hydration');
      return;
    }

    // Log API configuration
    console.log('[UnifiedUser] Backend API URL:', config.API_URL);
    console.log('[UnifiedUser] Full tRPC URL:', `${config.API_URL}/api/trpc`);
    
    // Test backend connectivity (non-blocking, with timeout)
    const testBackendConnectivity = async () => {
      // Only test if app is active
      if (AppState.currentState !== 'active') {
        console.log('[UnifiedUser] App not active, skipping connectivity test');
        return;
      }

      try {
        const testClient = createBackendClient();
        // Try a simple query to test connectivity with timeout
        const testPromise = testClient.user.get.query({ email: 'test@test.com' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connectivity test timeout')), 5000)
        );
        
        await Promise.race([testPromise, timeoutPromise]);
        console.log('[UnifiedUser] Backend connectivity test:', {
          reachable: true,
          responseReceived: true,
        });
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isNetworkError = errorMessage.includes('Network') || 
                              errorMessage.includes('fetch') || 
                              errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('ECONNREFUSED') ||
                              errorMessage.includes('timeout');
        
        console.warn('[UnifiedUser] Backend connectivity test:', {
          reachable: false,
          isNetworkError,
          error: errorMessage.substring(0, 200),
        });
        
        if (isNetworkError) {
          console.warn('[UnifiedUser] ⚠️ Backend appears to be unreachable - database operations may fail');
          console.warn('[UnifiedUser] ⚠️ Users can still sign in with Supabase, but data won\'t sync to database');
        }
      }
    };
    
    // Test connectivity after a short delay (non-blocking)
    setTimeout(testBackendConnectivity, 1000);
    
    hasLoadedRef.current = true;
    loadUser();
    
    // Listen for Supabase auth state changes to sync with unified user store
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Don't process auth changes if app is in background
      if (appStateRef.current !== 'active') {
        console.log('[UnifiedUser] App not active, deferring auth state change');
        return;
      }

      console.log('[UnifiedUser] Supabase auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // User signed in - check if unified user store needs to be updated
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          // If user is guest but we have Supabase session, we need to restore registered user
          if (userData.isGuest === true) {
            console.log('[UnifiedUser] Supabase session detected but user is guest, triggering sign-in to restore user...');
            // The unified user store's signIn should have been called, but if it wasn't,
            // we need to reload user data. For now, reload user after a delay to let signIn complete
            setTimeout(async () => {
              if (appStateRef.current === 'active') {
                await loadUser();
              }
            }, 2000);
          }
        } else {
          // No user in storage but we have Supabase session - need to restore
          console.log('[UnifiedUser] Supabase session detected but no user in storage, will be restored by signIn');
        }
      } else if (event === 'SIGNED_OUT') {
        // User signed out - unified user store's signOut should handle this
        console.log('[UnifiedUser] Supabase session signed out');
      }
    });
    
    // Listen for subscription updates from RevenueCat/subscription store
    const subscriptionUpdateListener = DeviceEventEmitter.addListener('subscription-updated', async (subscriptionState: {
      plan: 'free' | 'monthly' | 'annual' | 'lifetime';
      isActive: boolean;
      expiresAt?: Date;
      purchasedAt?: Date;
    }) => {
      // Get latest user from ref (updated below)
      const currentUser = userRef.current;
      if (!currentUser || currentUser.isGuest) {
        console.log('[UnifiedUser] Skipping subscription sync - user is guest or not available');
        return;
      }

      console.log('[UnifiedUser] Subscription updated from RevenueCat, syncing to database...', {
        plan: subscriptionState.plan,
        isActive: subscriptionState.isActive,
      });

      // Check if user just became premium (was free/guest, now has active premium subscription)
      const wasPremium = currentUser.subscriptionPlan && 
                        currentUser.subscriptionPlan !== 'free' &&
                        currentUser.subscriptionStatus === 'active';
      const isLifetime = subscriptionState.plan === 'lifetime';
      const isMonthlyOrAnnual = subscriptionState.plan === 'monthly' || subscriptionState.plan === 'annual';
      const hasValidExpiration = !subscriptionState.expiresAt || subscriptionState.expiresAt > new Date();
      const isNowPremium = subscriptionState.plan && 
                           subscriptionState.plan !== 'free' &&
                           subscriptionState.isActive &&
                           (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));
      const justBecamePremium = !wasPremium && isNowPremium;

      try {
        // Update unified user with subscription data
        const updatedUser: UnifiedUser = {
          ...currentUser,
          subscriptionPlan: subscriptionState.plan,
          subscriptionStatus: subscriptionState.isActive ? 'active' : null,
          subscriptionExpiresAt: subscriptionState.expiresAt ? new Date(subscriptionState.expiresAt) : null,
          subscriptionPurchasedAt: subscriptionState.purchasedAt ? new Date(subscriptionState.purchasedAt) : null,
        };
        
        // Save to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        userRef.current = updatedUser;
        setUserInternal(updatedUser);
        
        // Sync subscription data to database
        if (!currentUser.isGuest && currentUser.email) {
          const syncPayload = {
            email: currentUser.email,
            subscriptionPlan: subscriptionState.plan,
            subscriptionStatus: subscriptionState.isActive ? 'active' : null,
            subscriptionExpiresAt: subscriptionState.expiresAt ? new Date(subscriptionState.expiresAt).toISOString() : null,
            subscriptionPurchasedAt: subscriptionState.purchasedAt ? new Date(subscriptionState.purchasedAt).toISOString() : null,
          };
          
          const result = await updateUserMutation.mutateAsync(syncPayload);
          console.log('[UnifiedUser] ✅ Subscription synced to database:', result);
        }

        // CRITICAL: If user just became premium, trigger sync of existing local roadmap data
        // This ensures that when a guest user upgrades to premium, their existing local data gets synced to the database
        if (justBecamePremium) {
          console.log('[UnifiedUser] 🎉 User just became premium! Triggering sync of existing local roadmap data...');
          console.log('[UnifiedUser] Previous subscription:', {
            plan: currentUser.subscriptionPlan,
            status: currentUser.subscriptionStatus,
          });
          console.log('[UnifiedUser] New subscription:', {
            plan: subscriptionState.plan,
            isActive: subscriptionState.isActive,
          });
          
          // Emit event to trigger ambition store to sync existing local data
          // Use longer delay and multiple retries to ensure AsyncStorage is fully updated
          const triggerSync = async (attempt: number = 1) => {
            try {
              // Wait longer to ensure AsyncStorage write is complete
              await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 2000 : 1000));
              
              // Verify the user state is saved before triggering sync
              const { STORAGE_KEYS } = await import('../constants');
              const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
              if (storedUser) {
                const userData = JSON.parse(storedUser);
                const isLifetime = userData.subscriptionPlan === 'lifetime';
                const isMonthlyOrAnnual = userData.subscriptionPlan === 'monthly' || userData.subscriptionPlan === 'annual';
                const hasValidExpiration = !userData.subscriptionExpiresAt || new Date(userData.subscriptionExpiresAt) > new Date();
                const hasPremium = userData.subscriptionPlan && 
                                 userData.subscriptionPlan !== 'free' &&
                                 userData.subscriptionStatus === 'active' &&
                                 (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));
                
                if (hasPremium || attempt >= 3) {
                  // User is premium or we've tried 3 times, trigger sync
                  DeviceEventEmitter.emit('ambition-sync-trigger', { forceSync: true, isPremium: hasPremium });
                  console.log('[UnifiedUser] ✅ Emitted ambition-sync-trigger event (attempt', attempt, ') to sync existing local roadmap data');
                } else {
                  // Premium status not yet saved, retry
                  console.log('[UnifiedUser] Premium status not yet saved, retrying sync trigger (attempt', attempt, ')...');
                  if (attempt < 3) {
                    triggerSync(attempt + 1);
                  }
                }
              } else {
                console.warn('[UnifiedUser] User data not found in storage, cannot verify premium status');
                // Still trigger sync - the ambition store will check again
                DeviceEventEmitter.emit('ambition-sync-trigger', { forceSync: true });
              }
            } catch (e) {
              console.warn('[UnifiedUser] Could not emit ambition-sync-trigger event:', e);
              // Retry if we haven't tried 3 times yet
              if (attempt < 3) {
                triggerSync(attempt + 1);
              }
            }
          };
          
          triggerSync(1);
        }
      } catch (error) {
        console.error('[UnifiedUser] Failed to sync subscription to database:', error);
      }
    });

    return () => {
      subscription.unsubscribe();
      subscriptionUpdateListener.remove();
    };
  }, []); // Empty deps - we use userRef.current inside the listener

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);

    try {
      console.log('[UnifiedUser] Starting Google sign-in...');
      const result = await signInWithGoogleNative();

      if (!result.success) {
        if (result.error?.message?.toLowerCase().includes('cancel')) {
          console.log('[UnifiedUser] Google sign-in cancelled by user');
          return false;
        }
        if ((result.error as any)?.code === 'SIGN_IN_CANCELLED') {
          console.log('[UnifiedUser] Google sign-in cancelled (code)');
          return false;
        }
        throw (result.error || new Error('Google sign-in failed. Please try again.'));
      }

      let authUser = result.user as SupabaseUser | undefined;

      if (!authUser) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[UnifiedUser] Failed to retrieve Supabase session after Google sign-in:', sessionError);
        }
        authUser = sessionData.session?.user as SupabaseUser | undefined;
      }

      if (!authUser) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('[UnifiedUser] Failed to fetch Supabase user after Google sign-in:', userError);
        }
        authUser = userData?.user as SupabaseUser | undefined;
      }

      if (!authUser) {
        // Wait briefly and retry once to handle potential race conditions
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: retrySession } = await supabase.auth.getSession();
        authUser = retrySession.session?.user as SupabaseUser | undefined;
      }

      if (!authUser) {
        throw new Error('Google sign-in did not return a user account. Please try again.');
      }

      const email = authUser.email || (authUser.user_metadata as any)?.email;
      if (!email) {
        throw new Error('Your Google account does not have an email address associated. Please use a different sign-in method.');
      }

      try {
        await Purchases.logIn(email);
        console.log('[UnifiedUser] RevenueCat user set to:', email);
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat login failed:', rcError);
      }

      const directClient = createBackendClient();
      let dbUser: any = null;
      let createdUser = false;

      // Attempt to load existing user from backend
      try {
        const bySupabaseId = await directClient.user.get.query({ supabaseId: authUser.id });
        if (bySupabaseId.success && bySupabaseId.user) {
          dbUser = bySupabaseId.user;
        } else {
          const byEmail = await directClient.user.get.query({ email });
          if (byEmail.success && byEmail.user) {
            dbUser = byEmail.user;
          }
        }
      } catch (getUserError) {
        const errorMsg = getUserError instanceof Error ? getUserError.message : String(getUserError);
        console.warn('[UnifiedUser] Error fetching user from backend after Google sign-in:', errorMsg);
        
        // If it's a JSON parse error or network error, log it but continue with fallback
        if (errorMsg.includes('JSON Parse error') || 
            errorMsg.includes('Unexpected character') ||
            errorMsg.includes('invalid JSON') ||
            errorMsg.includes('non-JSON') ||
            errorMsg.includes('Network request failed')) {
          console.warn('[UnifiedUser] Backend connectivity issue detected. Will create fallback user.');
        }
      }

      let guestData = null;

      if (!dbUser) {
        console.log('[UnifiedUser] No existing account found, creating user record from guest data...');
        guestData = await collectGuestData();

        const createPayload = {
          email,
          name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null,
          profilePicture: authUser.user_metadata?.picture || authUser.user_metadata?.avatar_url || null,
          supabaseId: authUser.id,
          revenueCatUserId: email,
          isGuest: false,
          guestData: {
            goal: guestData.goal,
            timeline: guestData.timeline,
            timeCommitment: guestData.timeCommitment,
            answers: guestData.answers ? JSON.stringify(guestData.answers) : null,
            roadmap: guestData.roadmap ? JSON.stringify(guestData.roadmap) : null,
            completedTasks: Array.isArray(guestData.completedTasks) ? JSON.stringify(guestData.completedTasks) : null,
            streakData: guestData.streakData ? JSON.stringify(guestData.streakData) : null,
            taskTimers: guestData.taskTimers ? JSON.stringify(guestData.taskTimers) : null,
            subscriptionPlan: guestData.subscriptionPlan,
            subscriptionStatus: guestData.subscriptionStatus,
            subscriptionExpiresAt: guestData.subscriptionExpiresAt?.toISOString(),
            subscriptionPurchasedAt: guestData.subscriptionPurchasedAt?.toISOString(),
          },
        };

        try {
          await createUserMutation.mutateAsync(createPayload);
          createdUser = true;
          console.log('[UnifiedUser] ✅ Created user from Google sign-in guest data via mutation');
        } catch (createError) {
          const errorMsg = createError instanceof Error ? createError.message : String(createError);
          console.warn('[UnifiedUser] user.create mutation failed, attempting direct client fallback:', errorMsg);
          
          // Check if it's a JSON parse error - if so, skip direct client attempt
          if (errorMsg.includes('JSON Parse error') || 
              errorMsg.includes('Unexpected character') ||
              errorMsg.includes('invalid JSON') ||
              errorMsg.includes('non-JSON')) {
            console.warn('[UnifiedUser] Backend returned non-JSON response. Skipping direct client attempt and using fallback user.');
            createdUser = false;
          } else {
            try {
              await directClient.user.create.mutate(createPayload);
              createdUser = true;
              console.log('[UnifiedUser] ✅ Created user from Google sign-in guest data via direct client fallback');
            } catch (directCreateError) {
              createdUser = false;
              const directErrorMsg = directCreateError instanceof Error ? directCreateError.message : String(directCreateError);
              console.error('[UnifiedUser] Failed to create user from Google sign-in via direct client:', directErrorMsg);
              console.warn('[UnifiedUser] Continuing with local fallback user after Google sign-in failure.');
            }
          }
        }

        if (createdUser) {
          try {
            const newUserResult = await directClient.user.get.query({ email });
            if (newUserResult.success && newUserResult.user) {
              dbUser = newUserResult.user;
            }
          } catch (postCreateError) {
            const errorMsg = postCreateError instanceof Error ? postCreateError.message : String(postCreateError);
            console.warn('[UnifiedUser] Unable to fetch user after creation:', errorMsg);
            // If it's a JSON parse error, we'll continue with fallback user
            if (errorMsg.includes('JSON Parse error') || 
                errorMsg.includes('Unexpected character') ||
                errorMsg.includes('invalid JSON') ||
                errorMsg.includes('non-JSON')) {
              console.warn('[UnifiedUser] Backend connectivity issue after user creation. Using fallback user.');
            }
          }
        }
      }

      // Check for local roadmap/goal data BEFORE any operations
      const localGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL);
      const localRoadmap = await AsyncStorage.getItem(STORAGE_KEYS.ROADMAP);
      const hasLocalData = !!(localGoal && localRoadmap);

      if (dbUser) {
        if (createdUser && !guestData) {
          guestData = await collectGuestData();
        }

        // Use database subscription data (it's the source of truth)
        // Only use guest data for subscription if database doesn't have it and we just created the user
        const userData: UnifiedUser = {
          id: dbUser.id || authUser.id,
          email: email || dbUser.email || authUser.email, // CRITICAL: Prioritize email from current Google sign-in (source of truth)
          name: dbUser.name || authUser.user_metadata?.name || null,
          username: dbUser.username || null,
          profilePicture: createdUser && guestData 
            ? (guestData.profilePicture || dbUser.profilePicture || authUser.user_metadata?.picture || null)
            : (dbUser.profilePicture || authUser.user_metadata?.picture || null),
          mode: 'registered',
          isGuest: false,
          createdAt: dbUser.createdAt ? new Date(dbUser.createdAt) : new Date(),
          // Always prefer database subscription data over guest data
          subscriptionPlan: (dbUser.subscriptionPlan || (createdUser && guestData ? guestData.subscriptionPlan : 'free')) as any,
          subscriptionStatus: (dbUser.subscriptionStatus || (createdUser && guestData ? guestData.subscriptionStatus : null)) as any,
          subscriptionExpiresAt: dbUser.subscriptionExpiresAt 
            ? new Date(dbUser.subscriptionExpiresAt) 
            : (createdUser && guestData ? guestData.subscriptionExpiresAt : null),
          subscriptionPurchasedAt: dbUser.subscriptionPurchasedAt 
            ? new Date(dbUser.subscriptionPurchasedAt) 
            : (createdUser && guestData ? guestData.subscriptionPurchasedAt : null),
        };

        // CRITICAL: Clear old user data first to prevent showing stale email
        console.log('[UnifiedUser] Clearing old user data before saving new user (Google):', {
          oldEmail: user?.email,
          newEmail: userData.email,
        });
        setUserInternal(null); // Clear state first
        
        // Save user data FIRST (so restore function can check premium status)
        await saveUser(userData);
        console.log('[UnifiedUser] User data saved with subscription (Google):', {
          email: userData.email,
          plan: userData.subscriptionPlan,
          status: userData.subscriptionStatus,
          expiresAt: userData.subscriptionExpiresAt,
          isLifetime: userData.subscriptionPlan === 'lifetime',
        });

        // Check if user is premium
        const isLifetime = userData.subscriptionPlan === 'lifetime';
        const isMonthlyOrAnnual = userData.subscriptionPlan === 'monthly' || userData.subscriptionPlan === 'annual';
        const hasValidExpiration = !userData.subscriptionExpiresAt || userData.subscriptionExpiresAt > new Date();
        const isPremium = userData.subscriptionPlan && 
                         userData.subscriptionPlan !== 'free' &&
                         userData.subscriptionStatus === 'active' &&
                         (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));

        // CRITICAL: Always restore server data if it exists, regardless of premium status
        // Premium check only applies to SYNCING (uploading), not RESTORING (downloading)
        const serverHasData = !!(dbUser.goal || dbUser.roadmap);
        
        if (serverHasData) {
          console.log('[UnifiedUser] Server has data - restoring from server (regardless of premium status)');
          // Restore server data (this will preserve local data if server doesn't have it)
          await restoreServerDataToLocal(dbUser);
          // Trigger reload to pick up restored data
          triggerAmbitionStoreReload();
        } else if (hasLocalData) {
          console.log('[UnifiedUser] No server data but local data exists - preserving local data');
          // Don't restore, keep local data - it will be synced later if user is premium
          // Don't clear guest data yet - we want to keep the local roadmap
          // Trigger reload to ensure ambition store has the data
          triggerAmbitionStoreReload();
          // Still restore subscription data even if no roadmap data
          await restoreServerDataToLocal(dbUser);
        } else {
          console.log('[UnifiedUser] No server data and no local data - user will start fresh');
          // Still restore subscription data even if no roadmap data
          await restoreServerDataToLocal(dbUser);
        }
        
        // Trigger initial sync for premium users ONLY if we have local data that might differ from server
        // Don't sync immediately after restore - wait for store to hydrate and only sync if we have local changes
        if (isPremium && hasLocalData && !serverHasData) {
          console.log('[UnifiedUser] Premium user with local data (no server data), will sync after store hydrates...');
          // Wait longer to ensure store is hydrated before syncing
          setTimeout(() => {
            try {
              DeviceEventEmitter.emit('ambition-sync-trigger', { forceSync: true, isPremium: true });
              console.log('[UnifiedUser] ✅ Emitted sync event for premium user with local data (Google)');
            } catch (e) {
              console.warn('[UnifiedUser] Could not emit sync event:', e);
            }
          }, 3000); // Increased delay to ensure store is hydrated
        } else if (isPremium && serverHasData) {
          console.log('[UnifiedUser] Premium user with server data restored - skipping immediate sync to prevent data loss');
          // Don't sync immediately after restore - the data is already in the database
        }
      } else {
        // No dbUser - use guest data to create fallback user
        guestData = guestData || await collectGuestData();
        const fallbackUser: UnifiedUser = {
          id: authUser.id,
          email,
          name: authUser.user_metadata?.name || null,
          username: null,
          profilePicture: guestData.profilePicture || authUser.user_metadata?.picture || null,
          mode: 'registered',
          isGuest: false,
          createdAt: new Date(),
          subscriptionPlan: guestData.subscriptionPlan as any,
          subscriptionStatus: guestData.subscriptionStatus as any,
          subscriptionExpiresAt: guestData.subscriptionExpiresAt,
          subscriptionPurchasedAt: guestData.subscriptionPurchasedAt,
        };
        await saveUser(fallbackUser);
        
        // If we have local data, preserve it - don't clear
        if (hasLocalData) {
          console.log('[UnifiedUser] No server user but local data exists - preserving local data');
          // Don't clear guest data - we want to keep the roadmap
        }
      }

      // Only clear guest data if we don't have local roadmap/goal data to preserve
      // OR if we successfully restored from server
      if (guestData && !hasLocalData) {
        console.log('[UnifiedUser] No local data to preserve - clearing guest data');
        await clearGuestData();
      } else if (guestData && hasLocalData) {
        console.log('[UnifiedUser] Local data exists - preserving it, not clearing guest data');
        // Don't clear - we want to keep the local roadmap/goal
        // Trigger reload so ambition store picks up the preserved data
        triggerAmbitionStoreReload();
      }

      console.log('[UnifiedUser] ✅ Google sign-in complete');
      return true;
    } catch (error) {
      console.error('[UnifiedUser] Google sign-in error:', error);
      
      // Handle JSON parse errors specifically
      if (error instanceof Error) {
        const errorMessage = error.message || '';
        
        // Check for JSON parse errors
        if (errorMessage.includes('JSON Parse error') || 
            errorMessage.includes('Unexpected character') ||
            errorMessage.includes('invalid JSON') ||
            errorMessage.includes('non-JSON') ||
            errorMessage.includes('Server returned non-JSON') ||
            errorMessage.includes('Server returned invalid JSON')) {
          console.error('[UnifiedUser] Backend returned non-JSON response. This usually means the backend server is not running or returned an error page.');
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        
        // Check for network errors
        if (errorMessage.includes('Network request failed') || 
            errorMessage.includes('fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ERR_NETWORK') ||
            errorMessage.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        
        // Check for backend connectivity issues
        if (errorMessage.includes('Backend is running') || 
            errorMessage.includes('API URL')) {
          throw new Error('Unable to connect to the server. Please try again later.');
        }
        
        // For other errors, provide a user-friendly message
        throw new Error(errorMessage || 'Failed to sign in with Google. Please try again.');
      }
      
      throw new Error('Failed to sign in with Google. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [createUserMutation]);

  const loadUser = async () => {
    try {
      // Don't load if app is not active (prevents hanging on resume)
      if (appStateRef.current !== 'active') {
        console.log('[UnifiedUser] App not active, skipping loadUser');
        // Still mark as hydrated to prevent blocking
        setIsHydrated(true);
        return;
      }

      // First check for Supabase session - if we have one, we should have a registered user
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if we have a stored user
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Convert date strings back to dates
        if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
        if (parsed.subscriptionExpiresAt) parsed.subscriptionExpiresAt = new Date(parsed.subscriptionExpiresAt);
        if (parsed.subscriptionPurchasedAt) parsed.subscriptionPurchasedAt = new Date(parsed.subscriptionPurchasedAt);
        
        // If we have a Supabase session but stored user is guest, we need to restore registered user
        if (session?.user && parsed.isGuest === true) {
          console.warn('[UnifiedUser] Supabase session exists but user is marked as guest - restoring registered user...');
          // Try to restore user data by calling signIn with the session
          // We'll need to fetch user data from the database
          try {
            // Check app state before making network request
            if (appStateRef.current !== 'active') {
              console.log('[UnifiedUser] App not active, skipping network request');
              setUserInternal(parsed);
              setIsHydrated(true);
              return;
            }

            const directClient = createBackendClient();
            // Add timeout to prevent hanging
            const queryPromise = directClient.user.get.query({ supabaseId: session.user.id });
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('User fetch timeout')), 8000)
            );
            const result = await Promise.race([queryPromise, timeoutPromise]) as any;
            if (result.success && result.user) {
              const dbUser = result.user;
              const userData: UnifiedUser = {
                id: dbUser.id || session.user.id,
                email: dbUser.email || session.user.email || null,
                name: dbUser.name || null,
                username: dbUser.username || null,
                profilePicture: dbUser.profilePicture || null,
                mode: 'registered',
                isGuest: false,
                createdAt: dbUser.createdAt ? new Date(dbUser.createdAt) : new Date(),
                subscriptionPlan: (dbUser.subscriptionPlan || 'free') as any,
                subscriptionStatus: dbUser.subscriptionStatus as any,
                subscriptionExpiresAt: dbUser.subscriptionExpiresAt ? new Date(dbUser.subscriptionExpiresAt) : null,
                subscriptionPurchasedAt: dbUser.subscriptionPurchasedAt ? new Date(dbUser.subscriptionPurchasedAt) : null,
              };
              await saveUser(userData);
              // Restore server data (non-blocking - if it fails, user can still use the app)
              restoreServerDataToLocal(dbUser).catch((restoreError) => {
                console.warn('[UnifiedUser] Error restoring server data (non-critical):', restoreError);
                // Continue anyway - user data is saved, they can use the app
              });
              console.log('[UnifiedUser] ✅ Restored registered user from Supabase session');
              return; // Exit early since we've set the user
            }
          } catch (restoreError: any) {
            const errorMsg = restoreError?.message || String(restoreError);
            console.error('[UnifiedUser] Error restoring user from Supabase session:', errorMsg);
            
            // If backend is unavailable but we have a Supabase session, create fallback registered user
            // This prevents resetting to guest when backend has connectivity issues
            if (session?.user) {
              console.warn('[UnifiedUser] ⚠️ Backend unavailable, creating fallback registered user from Supabase session');
              const fallbackUser: UnifiedUser = {
                id: session.user.id,
                email: session.user.email || null,
                name: session.user.user_metadata?.name || null,
                username: null,
                profilePicture: session.user.user_metadata?.picture || null,
                mode: 'registered',
                isGuest: false,
                createdAt: new Date(session.user.created_at || Date.now()),
                subscriptionPlan: 'free',
                subscriptionStatus: null,
                subscriptionExpiresAt: null,
                subscriptionPurchasedAt: null,
              };
              await saveUser(fallbackUser);
              console.log('[UnifiedUser] ✅ Created fallback registered user from Supabase session');
              return; // Exit early since we've set the user
            }
            
            // Only continue with guest user if there's no Supabase session
            // If we have a session, we've already created a fallback registered user above
          }
        }
        
        setUserInternal(parsed);
          } else {
            // No stored user - check if we have Supabase session
            if (session?.user) {
            console.log('[UnifiedUser] No stored user but Supabase session exists - restoring registered user...');
            // Try to restore user data from database
            try {
              // Check app state before making network request
              if (appStateRef.current !== 'active') {
                console.log('[UnifiedUser] App not active, creating fallback user');
                const fallbackUser: UnifiedUser = {
                  id: session.user.id,
                  email: session.user.email || null,
                  name: session.user.user_metadata?.name || null,
                  username: null,
                  profilePicture: session.user.user_metadata?.picture || null,
                  mode: 'registered',
                  isGuest: false,
                  createdAt: new Date(session.user.created_at || Date.now()),
                  subscriptionPlan: 'free',
                  subscriptionStatus: null,
                  subscriptionExpiresAt: null,
                  subscriptionPurchasedAt: null,
                };
                await saveUser(fallbackUser);
                setIsHydrated(true);
                return;
              }

              const directClient = createBackendClient();
              // Add timeout to prevent hanging
              const queryPromise = directClient.user.get.query({ supabaseId: session.user.id });
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('User fetch timeout')), 8000)
              );
              const result = await Promise.race([queryPromise, timeoutPromise]) as any;
              if (result.success && result.user) {
                const dbUser = result.user;
                const userData: UnifiedUser = {
                  id: dbUser.id || session.user.id,
                  email: dbUser.email || session.user.email || null,
                  name: dbUser.name || null,
                  username: dbUser.username || null,
                  profilePicture: dbUser.profilePicture || null,
                  mode: 'registered',
                  isGuest: false,
                  createdAt: dbUser.createdAt ? new Date(dbUser.createdAt) : new Date(),
                  subscriptionPlan: (dbUser.subscriptionPlan || 'free') as any,
                  subscriptionStatus: dbUser.subscriptionStatus as any,
                  subscriptionExpiresAt: dbUser.subscriptionExpiresAt ? new Date(dbUser.subscriptionExpiresAt) : null,
                  subscriptionPurchasedAt: dbUser.subscriptionPurchasedAt ? new Date(dbUser.subscriptionPurchasedAt) : null,
                };
              await saveUser(userData);
              // Restore server data (non-blocking - if it fails, user can still use the app)
              restoreServerDataToLocal(dbUser).catch((restoreError) => {
                console.warn('[UnifiedUser] Error restoring server data (non-critical):', restoreError);
                // Continue anyway - user data is saved, they can use the app
              });
              console.log('[UnifiedUser] ✅ Restored registered user from Supabase session (no stored user)');
              return; // Exit early since we've set the user
              }
            } catch (restoreError: any) {
              const errorMsg = restoreError?.message || String(restoreError);
              console.error('[UnifiedUser] Error restoring user from Supabase session:', errorMsg);
              
              // If there's a Supabase session, create a fallback registered user instead of guest
              // This prevents resetting the user when backend is unavailable
              if (session?.user) {
                console.warn('[UnifiedUser] ⚠️ Backend unavailable, creating fallback registered user from Supabase session');
                const fallbackUser: UnifiedUser = {
                  id: session.user.id,
                  email: session.user.email || null,
                  name: session.user.user_metadata?.name || null,
                  username: null,
                  profilePicture: session.user.user_metadata?.picture || null,
                  mode: 'registered',
                  isGuest: false,
                  createdAt: new Date(session.user.created_at || Date.now()),
                  subscriptionPlan: 'free',
                  subscriptionStatus: null,
                  subscriptionExpiresAt: null,
                  subscriptionPurchasedAt: null,
                };
                await saveUser(fallbackUser);
                console.log('[UnifiedUser] ✅ Created fallback registered user from Supabase session');
                return; // Exit early since we've set the user
              }
              
              // Only create guest user if there's no Supabase session
              await createGuestUser();
            }
          } else {
            // No session, no stored user - create guest user
            await createGuestUser();
          }
        }
    } catch (error) {
      console.error('[UnifiedUser] Error loading user:', error);
      
      // Before creating guest user, check if we have a Supabase session
      // If we do, create a fallback registered user instead
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.warn('[UnifiedUser] ⚠️ Error loading user but Supabase session exists - creating fallback registered user');
          const fallbackUser: UnifiedUser = {
            id: session.user.id,
            email: session.user.email || null,
            name: session.user.user_metadata?.name || null,
            username: null,
            profilePicture: session.user.user_metadata?.picture || null,
            mode: 'registered',
            isGuest: false,
            createdAt: new Date(session.user.created_at || Date.now()),
            subscriptionPlan: 'free',
            subscriptionStatus: null,
            subscriptionExpiresAt: null,
            subscriptionPurchasedAt: null,
          };
          await saveUser(fallbackUser);
          console.log('[UnifiedUser] ✅ Created fallback registered user from Supabase session (error handler)');
        } else {
          // No Supabase session - create guest user
          await createGuestUser();
        }
      } catch (sessionError) {
        console.error('[UnifiedUser] Error checking Supabase session in error handler:', sessionError);
        // If we can't check session, create guest user as last resort
        await createGuestUser();
      }
    } finally {
      setIsHydrated(true);
    }
  };

  const createGuestUser = async () => {
    const guestId = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_ID) || generateGuestId();
    await AsyncStorage.setItem(STORAGE_KEYS.GUEST_ID, guestId);

    const guestUser: UnifiedUser = {
      id: guestId,
      email: null,
      name: null,
      username: null,
      profilePicture: null,
      mode: 'guest',
      isGuest: true,
      createdAt: new Date(),
      subscriptionPlan: 'free',
      subscriptionStatus: null,
      subscriptionExpiresAt: null,
      subscriptionPurchasedAt: null,
    };

    setUserInternal(guestUser);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(guestUser));
    console.log('[UnifiedUser] Created guest user:', guestId);
  };

  const saveUser = async (updatedUser: UnifiedUser) => {
    setUserInternal(updatedUser);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
  };

  // Helper function to trigger ambition store reload
  const triggerAmbitionStoreReload = () => {
    setTimeout(() => {
      try {
        DeviceEventEmitter.emit('ambition-storage-reload');
        console.log('[UnifiedUser] ✅ Triggered ambition store reload');
      } catch (e) {
        console.warn('[UnifiedUser] Could not emit storage reload event:', e);
      }
    }, 500); // Increased delay to ensure AsyncStorage writes are complete
  };

  // Restore server data to local storage (for all users - premium status only affects cloud sync)
  const restoreServerDataToLocal = async (dbUser: any) => {
    try {
      // Check if user has premium subscription
      // Premium plans: 'monthly', 'annual', 'lifetime'
      // Lifetime plans don't have expiration dates, so handle them specially
      // Monthly and annual plans need valid expiration dates
      const isLifetime = dbUser.subscriptionPlan === 'lifetime';
      const isMonthlyOrAnnual = dbUser.subscriptionPlan === 'monthly' || dbUser.subscriptionPlan === 'annual';
      const hasValidExpiration = !dbUser.subscriptionExpiresAt || new Date(dbUser.subscriptionExpiresAt) > new Date();
      const hasPremium = dbUser.subscriptionPlan && 
                        dbUser.subscriptionPlan !== 'free' &&
                        dbUser.subscriptionStatus === 'active' &&
                        (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));
      
      // CRITICAL: Always restore roadmap/goal data if it exists in the database, regardless of premium status
      // The premium check should only apply to SYNCING (uploading), not RESTORING (downloading)
      // Users may have created roadmaps when they were premium, and should still see them even if subscription expired
      const hasServerData = !!(dbUser.goal || dbUser.roadmap);
      
      if (!hasServerData) {
        console.log('[UnifiedUser] No server data to restore', {
          hasGoal: !!dbUser.goal,
          hasRoadmap: !!dbUser.roadmap,
        });
        // Still restore subscription data even if no roadmap data
        // (subscription restoration is handled below)
      } else {
        console.log('[UnifiedUser] Restoring server data to local storage...', {
          hasPremium,
          plan: dbUser.subscriptionPlan,
          status: dbUser.subscriptionStatus,
          isLifetime,
          hasGoal: !!dbUser.goal,
          hasRoadmap: !!dbUser.roadmap,
        });
      }
      
      // Check for active task timers locally before restoring
      const localTaskTimersStr = await AsyncStorage.getItem(STORAGE_KEYS.TASK_TIMERS);
      let localTaskTimers: any[] = [];
      let hasActiveLocalTimer = false;
      
      if (localTaskTimersStr) {
        try {
          localTaskTimers = JSON.parse(localTaskTimersStr);
          // Check if any timer is currently active (has startTime and no endTime, or is within duration)
          hasActiveLocalTimer = localTaskTimers.some((timer: any) => {
            if (!timer.startTime) return false;
            const startTime = new Date(timer.startTime).getTime();
            const now = Date.now();
            const elapsed = (now - startTime) / 1000; // seconds
            const duration = timer.duration || 0; // seconds
            return elapsed < duration && !timer.endTime;
          });
          console.log('[UnifiedUser] Local task timers check:', {
            count: localTaskTimers.length,
            hasActive: hasActiveLocalTimer,
          });
        } catch (e) {
          console.warn('[UnifiedUser] Failed to parse local task timers:', e);
        }
      }
      
      const restorePromises: Promise<void>[] = [];
      
      // Check local data to preserve it if server doesn't have it
      const [localGoal, localRoadmap, localTimeline, localTimeCommitment, localAnswers, localCompletedTasks, localStreakData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.ROADMAP),
        AsyncStorage.getItem(STORAGE_KEYS.TIMELINE),
        AsyncStorage.getItem(STORAGE_KEYS.TIME_COMMITMENT),
        AsyncStorage.getItem(STORAGE_KEYS.ANSWERS),
        AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA),
      ]);
      
      // Restore goal and roadmap data (use server data if available, otherwise preserve local)
      // CRITICAL: Always preserve local data if server doesn't have it
      if (dbUser.goal) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.GOAL, dbUser.goal));
        console.log('[UnifiedUser] Restoring goal from server');
      } else if (localGoal) {
        // Preserve local goal if server doesn't have it - don't clear it
        console.log('[UnifiedUser] Preserving local goal (server has none)');
        // Explicitly keep the local goal - don't remove it
      }
      if (dbUser.timeline) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TIMELINE, dbUser.timeline));
        console.log('[UnifiedUser] Restoring timeline from server');
      } else if (localTimeline) {
        console.log('[UnifiedUser] Preserving local timeline (server has none)');
      }
      if (dbUser.timeCommitment) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TIME_COMMITMENT, dbUser.timeCommitment));
        console.log('[UnifiedUser] Restoring time commitment from server');
      } else if (localTimeCommitment) {
        console.log('[UnifiedUser] Preserving local time commitment (server has none)');
      }
      if (dbUser.answers) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.ANSWERS, dbUser.answers));
        console.log('[UnifiedUser] Restoring answers from server');
      } else if (localAnswers) {
        console.log('[UnifiedUser] Preserving local answers (server has none)');
      }
      if (dbUser.roadmap) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, dbUser.roadmap));
        console.log('[UnifiedUser] Restoring roadmap from server');
      } else if (localRoadmap) {
        // Preserve local roadmap if server doesn't have it - CRITICAL: don't clear it
        console.log('[UnifiedUser] Preserving local roadmap (server has none) - keeping local data');
        // Explicitly keep the local roadmap - don't remove it
      }
      if (dbUser.completedTasks) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, dbUser.completedTasks));
      } else if (localCompletedTasks) {
        console.log('[UnifiedUser] Preserving local completed tasks (server has none)');
      }
      if (dbUser.streakData) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, dbUser.streakData));
      } else if (localStreakData) {
        console.log('[UnifiedUser] Preserving local streak data (server has none)');
      }
      
        // Handle task timers intelligently: preserve active local timers
        if (hasActiveLocalTimer && localTaskTimers.length > 0) {
          // Merge local active timers with server timers
          let serverTaskTimers: any[] = [];
          if (dbUser.taskTimers) {
            try {
              serverTaskTimers = JSON.parse(dbUser.taskTimers);
            } catch (e: any) {
              const parseError = e?.message || String(e);
              console.warn('[UnifiedUser] Failed to parse server task timers:', parseError);
              // If it's a JSON parse error, log it but continue with empty array
              if (parseError.includes('JSON Parse error') || 
                  parseError.includes('Unexpected character') ||
                  parseError.includes('invalid JSON')) {
                console.warn('[UnifiedUser] Server task timers data is corrupted, using empty array');
                serverTaskTimers = [];
              }
            }
          }
        
        // Keep active local timers, merge with server timers (avoid duplicates)
        const activeLocalTimers = localTaskTimers.filter((timer: any) => {
          if (!timer.startTime) return false;
          const startTime = new Date(timer.startTime).getTime();
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          const duration = timer.duration || 0;
          return elapsed < duration && !timer.endTime;
        });
        
        // Merge: active local timers + server timers (excluding duplicates by taskId)
        const mergedTimers = [...activeLocalTimers];
        serverTaskTimers.forEach((serverTimer: any) => {
          const exists = mergedTimers.some((t: any) => t.taskId === serverTimer.taskId);
          if (!exists) {
            mergedTimers.push(serverTimer);
          }
        });
        
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, JSON.stringify(mergedTimers)));
        console.log('[UnifiedUser] Preserved active local timers and merged with server timers:', {
          activeLocal: activeLocalTimers.length,
          server: serverTaskTimers.length,
          merged: mergedTimers.length,
        });
      } else if (dbUser.taskTimers) {
        // No active local timers, use server data
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, dbUser.taskTimers));
      }
      
      await Promise.all(restorePromises);
      console.log('[UnifiedUser] ✅ Server data restored to local storage');
      console.log('[UnifiedUser] Restored data summary:', {
        hasGoal: !!dbUser.goal,
        hasRoadmap: !!dbUser.roadmap,
        hasCompletedTasks: !!dbUser.completedTasks,
        goalLength: dbUser.goal?.length || 0,
        roadmapLength: dbUser.roadmap?.length || 0,
        preservedActiveTimers: hasActiveLocalTimer,
      });
      
      // CRITICAL: Always restore subscription data from database (it's account-level data)
      // Subscription data should be restored regardless of premium status
      if (dbUser.subscriptionPlan !== undefined || dbUser.subscriptionStatus !== undefined) {
        try {
          const subscriptionState = {
            plan: (dbUser.subscriptionPlan || 'free') as 'free' | 'monthly' | 'annual' | 'lifetime',
            isActive: dbUser.subscriptionStatus === 'active',
            expiresAt: dbUser.subscriptionExpiresAt ? new Date(dbUser.subscriptionExpiresAt) : undefined,
            purchasedAt: dbUser.subscriptionPurchasedAt ? new Date(dbUser.subscriptionPurchasedAt) : undefined,
          };
          
          // Save to subscription store's AsyncStorage
          await AsyncStorage.setItem('ambitionly_subscription_state', JSON.stringify(subscriptionState));
          
          // Trigger subscription store reload
          DeviceEventEmitter.emit('subscription-restore', subscriptionState);
          
          // Also update unified user store with subscription data from database
          const currentUser = user;
          if (currentUser && !currentUser.isGuest) {
            const updatedUser: UnifiedUser = {
              ...currentUser,
              subscriptionPlan: subscriptionState.plan as any,
              subscriptionStatus: subscriptionState.isActive ? 'active' : (dbUser.subscriptionStatus as any || null),
              subscriptionExpiresAt: subscriptionState.expiresAt || null,
              subscriptionPurchasedAt: subscriptionState.purchasedAt || null,
            };
            await saveUser(updatedUser);
            setUserInternal(updatedUser);
            console.log('[UnifiedUser] ✅ Updated unified user store with subscription data from database');
          }
          
          console.log('[UnifiedUser] ✅ Subscription data restored from database:', {
            plan: subscriptionState.plan,
            isActive: subscriptionState.isActive,
            expiresAt: subscriptionState.expiresAt,
          });
        } catch (subError) {
          console.warn('[UnifiedUser] Failed to restore subscription data:', subError);
        }
      }
      
      // Trigger ambition store reload to load the restored data
      triggerAmbitionStoreReload();
    } catch (error) {
      console.error('[UnifiedUser] Error restoring server data:', error);
      // Don't throw - continue with sign in even if restore fails
    }
  };

  // Sign up: Convert guest to registered user
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    // Ensure user is loaded before proceeding
    if (!isHydrated) {
      throw new Error('User session not ready. Please wait a moment and try again.');
    }
    
    // Create guest user if none exists
    if (!user) {
      console.log('[UnifiedUser] No user found, creating guest user first');
      await createGuestUser();
      // Reload to get the new user
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
        if (parsed.subscriptionExpiresAt) parsed.subscriptionExpiresAt = new Date(parsed.subscriptionExpiresAt);
        if (parsed.subscriptionPurchasedAt) parsed.subscriptionPurchasedAt = new Date(parsed.subscriptionPurchasedAt);
        setUserInternal(parsed);
      } else {
        throw new Error('Failed to create user session');
      }
    }
    
    setIsAuthenticating(true);
    
    try {
      console.log('[UnifiedUser] Starting sign up for:', email);
      console.log('[UnifiedUser] Sign up payload preview:', {
        email,
        passwordLength: password?.length ?? 0,
        hasPassword: typeof password === 'string',
      });
      
      // 1. Try to create user via backend first (this auto-confirms email and creates Supabase user)
      let supabaseUserId: string | null = null;
      let backendSignupSucceeded = false;
      
      try {
        console.log('[UnifiedUser] Sending auth.signup mutation payload:', {
          email,
          passwordLength: password.length,
        });
        const signupResult = await signupMutation.mutateAsync({
          email,
          password,
        });
        supabaseUserId = signupResult.supabaseUserId || null;
        backendSignupSucceeded = true;
        console.log('[UnifiedUser] ✅ User created via backend, Supabase ID:', supabaseUserId);
      } catch (backendError: any) {
        console.warn('[UnifiedUser] Backend signup failed, will try Supabase directly:', backendError);
        
        // Check for network errors - if it's a network error, fall back to Supabase
        const errorMessage = backendError?.message || String(backendError);
        const isNetworkError = errorMessage.includes('Network request failed') || 
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ERR_NETWORK') ||
            errorMessage.includes('Network request failed') ||
            errorMessage.includes('Cannot connect to server') ||
            errorMessage.includes('already read') || // Response body already read error
            errorMessage.includes('body stream already read');
        const isTransformError = errorMessage.includes('Unable to transform response') ||
          errorMessage.includes('Invalid input: expected object') ||
          errorMessage.includes('Transformation error (deserialize)');
        const isServerError = errorMessage.includes('Server returned non-JSON response') ||
          errorMessage.includes('Server returned invalid JSON') ||
          errorMessage.includes('HTTP 5') ||
          errorMessage.includes('503') ||
          errorMessage.includes('504') ||
          errorMessage.includes('Bad Gateway') ||
          errorMessage.includes('Service Unavailable');
        
        // If email is already registered, throw error to prevent duplicate signup
        if (errorMessage.includes('already registered') || errorMessage.includes('Email already')) {
          console.log('[UnifiedUser] Email already registered, preventing duplicate signup');
          throw new Error('This email is already registered. Please sign in instead.');
        }
        
        // If it's not a network error and not "user already exists", throw the error
        // Network errors will fall through to Supabase signup below
        if (!isNetworkError && !isTransformError && !isServerError && !supabaseUserId) {
          console.error('[UnifiedUser] Backend signup error (not network/transform):', backendError);
          throw backendError;
        }
        
        // If we get here with a network/transform error, we'll fall back to Supabase signup
        console.log('[UnifiedUser] Backend unavailable or returned invalid response, falling back to Supabase signup');
      }
      
      // 2. If backend didn't create Supabase user, try to create with auto-confirmation via backend endpoint
      if (!supabaseUserId) {
        console.log('[UnifiedUser] Backend signup failed, trying to create Supabase user with auto-confirmation...');
        
        // Try to use backend endpoint to create Supabase user with auto-confirmation (no email verification required)
        try {
          const confirmResult = await confirmSupabaseUserMutation.mutateAsync({
            email,
            password,
          });
          
          if (confirmResult.success && confirmResult.supabaseUserId) {
            supabaseUserId = confirmResult.supabaseUserId;
            console.log('[UnifiedUser] ✅ Created Supabase user with auto-confirmation via backend endpoint');
          } else {
            throw new Error('Failed to create Supabase user via backend endpoint');
          }
        } catch (confirmError: any) {
          const confirmMessage = confirmError?.message || String(confirmError);
          
          // Check if email is already registered
          if (confirmMessage.includes('already registered') || confirmMessage.includes('Email already') || confirmMessage.includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          
          console.warn('[UnifiedUser] Backend confirm endpoint failed, falling back to direct Supabase signup:', confirmError);
          const isTransformError = confirmMessage.includes('Unable to transform response') ||
            confirmMessage.includes('Invalid input: expected object') ||
            confirmMessage.includes('Transformation error (deserialize)');
          if (isTransformError) {
            console.warn('[UnifiedUser] Backend confirm endpoint returned an unexpected transform error. Falling back to direct Supabase signup.');
          }
          
          // Fallback: Create user directly with Supabase (will require email verification)
          // This should rarely happen if backend is available
          console.log('[UnifiedUser] Creating user directly with Supabase (email verification will be required)...');
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
          });
          
          if (authError) {
            console.error('[UnifiedUser] Supabase signup error:', authError);
            
            // Provide user-friendly error messages
            if (authError.message.includes('User already registered') || 
                authError.message.includes('already registered') ||
                authError.message.includes('already exists')) {
              // User exists - prevent duplicate signup
              throw new Error('This email is already registered. Please sign in instead.');
            } else {
              throw new Error(authError.message || 'Failed to create user account');
            }
          } else if (!authData.user) {
            throw new Error('Failed to create user account');
          } else {
            supabaseUserId = authData.user.id;
            console.warn('[UnifiedUser] ⚠️ User created with Supabase, but email verification may be required');
            console.warn('[UnifiedUser] ⚠️ Check your email to verify your account, or the backend endpoint should have been used');
          }
        }
      } else if (backendSignupSucceeded) {
        // Backend signup succeeded, sign in with Supabase to establish session
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          console.warn('[UnifiedUser] Failed to sign in with Supabase after backend signup:', signInError);
          // Continue anyway - user is created in backend
        } else {
          console.log('[UnifiedUser] ✅ Signed in with Supabase after backend signup');
        }
      }
      
      if (!supabaseUserId) {
        throw new Error('Failed to get Supabase user ID');
      }
      
      // 3. Set RevenueCat user ID to email
      try {
        await Purchases.logIn(email);
        console.log('[UnifiedUser] RevenueCat user set to:', email);
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat login failed:', rcError);
      }
      
      // 4. Collect guest data for migration
      const guestData = await collectGuestData();
      console.log('[UnifiedUser] Guest data collected for migration');
      
      // 5. Create user in database with guest data (only if backend is available)
      // If backend was unavailable, we'll skip this and sync later
      if (backendSignupSucceeded) {
        const directClient = createBackendClient();
        const createPayload = {
            email,
            name,
            supabaseId: supabaseUserId,
            revenueCatUserId: email,
            isGuest: false,
            guestData: {
              goal: guestData.goal,
              timeline: guestData.timeline,
              timeCommitment: guestData.timeCommitment,
              answers: guestData.answers ? JSON.stringify(guestData.answers) : null,
              roadmap: guestData.roadmap ? JSON.stringify(guestData.roadmap) : null,
              completedTasks: Array.isArray(guestData.completedTasks) ? JSON.stringify(guestData.completedTasks) : null,
              streakData: guestData.streakData ? JSON.stringify(guestData.streakData) : null,
              taskTimers: guestData.taskTimers ? JSON.stringify(guestData.taskTimers) : null,
              subscriptionPlan: guestData.subscriptionPlan,
              subscriptionStatus: guestData.subscriptionStatus,
              subscriptionExpiresAt: guestData.subscriptionExpiresAt?.toISOString(),
              subscriptionPurchasedAt: guestData.subscriptionPurchasedAt?.toISOString(),
            },
        };

        try {
          console.log('[UnifiedUser] Attempting to create user in database via mutation...');
          console.log('[UnifiedUser] Create payload summary:', {
            email: createPayload.email,
            hasName: !!createPayload.name,
            hasSupabaseId: !!createPayload.supabaseId,
            hasGuestData: !!createPayload.guestData,
            guestDataKeys: createPayload.guestData ? Object.keys(createPayload.guestData) : [],
          });
          
          const createResult = await createUserMutation.mutateAsync(createPayload);
          console.log('[UnifiedUser] ✅ User created in database with guest data via mutation:', {
            success: createResult.success,
            hasUser: !!createResult.user,
            userId: createResult.user?.id,
          });
        } catch (dbError: any) {
          console.error('[UnifiedUser] ❌ user.create mutation failed during sign up:', {
            message: dbError?.message,
            error: dbError,
            stack: dbError?.stack,
          });
          console.log('[UnifiedUser] Attempting direct client fallback...');
          try {
            const directResult = await directClient.user.create.mutate(createPayload);
            console.log('[UnifiedUser] ✅ User created in database with guest data via direct client fallback:', {
              success: directResult.success,
              hasUser: !!directResult.user,
              userId: directResult.user?.id,
            });
          } catch (directDbError: any) {
            console.error('[UnifiedUser] ❌ Database creation error (direct client also failed):', {
              message: directDbError?.message,
              error: directDbError,
              stack: directDbError?.stack,
            });
            console.warn('[UnifiedUser] ⚠️ Continuing sign-up - user is created in Supabase and local storage');
            console.warn('[UnifiedUser] ⚠️ Data will be synced to database when backend becomes available');
          // Continue anyway - user is created in Supabase and local storage
          // Data will be synced to database when backend becomes available
          }
        }
      } else {
        console.log('[UnifiedUser] Backend unavailable - user data will be synced to database when backend is available');
        // User is created in Supabase, data is in local storage
        // When backend becomes available, we can sync the data
      }
      
      // 6. Create registered user object
      const registeredUser: UnifiedUser = {
        id: supabaseUserId,
        email,
        name,
        username: null,
        profilePicture: guestData.profilePicture,
        mode: 'registered',
        isGuest: false,
        createdAt: new Date(),
        subscriptionPlan: guestData.subscriptionPlan as any,
        subscriptionStatus: guestData.subscriptionStatus as any,
        subscriptionExpiresAt: guestData.subscriptionExpiresAt,
        subscriptionPurchasedAt: guestData.subscriptionPurchasedAt,
      };
      
      // 7. Save to local storage
      await saveUser(registeredUser);
      
      // 8. Clear old guest data
      await clearGuestData();
      
      console.log('[UnifiedUser] ✅ Sign up complete, guest data migrated');
      console.log('[UnifiedUser] Sign-up summary:', {
        backendSignupSucceeded,
        hasSupabaseUserId: !!supabaseUserId,
        supabaseUserId,
        userId: registeredUser.id,
        email: registeredUser.email,
        isGuest: registeredUser.isGuest,
        subscriptionPlan: registeredUser.subscriptionPlan,
        hasSupabaseSession: true,
      });
      
      return { success: true, user: registeredUser };
    } catch (error) {
      console.error('[UnifiedUser] Sign up error:', error);
      // Ensure we always throw an Error with a message
      if (error instanceof Error) {
        // Provide user-friendly error messages
        if (error.message.includes('Email already registered') || error.message.includes('already exists')) {
          throw new Error('This email is already registered. Please sign in instead.');
        } else if (error.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.');
        } else if (error.message.includes('Password')) {
          throw new Error('Password must be at least 6 characters long.');
        } else if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else if (error.message.includes('User session not ready')) {
          throw error; // Keep this specific error
        } else {
          // Use the original error message if it exists, otherwise provide a generic one
          throw new Error(error.message || 'Failed to create account. Please try again.');
        }
      } else {
        // If error is not an Error instance, create one with a message
        const errorMessage = typeof error === 'string' ? error : 'Failed to create account. Please try again.';
        throw new Error(errorMessage);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [user, isHydrated, signupMutation, confirmSupabaseUserMutation, createUserMutation]);

  // Sign in: Load user from database
  const signIn = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true);
    
    try {
      console.log('[UnifiedUser] Starting sign in for:', email);
      
      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (authError) {
        // Convert Supabase error to Error instance with proper message
        const errorMessage = authError.message || 'Authentication failed';
        console.error('[UnifiedUser] Supabase auth error:', errorMessage);
        throw new Error(errorMessage);
      }
      if (!authData.user) throw new Error('Authentication failed');
      
      // 2. Set RevenueCat user ID
      try {
        await Purchases.logIn(email);
        console.log('[UnifiedUser] RevenueCat user set to:', email);
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat login failed:', rcError);
      }
      
      // 3. Fetch user data from database using direct client
      const directClient = createBackendClient();
      console.log('[UnifiedUser] Attempting to fetch user from database, Supabase ID:', authData.user.id);
      
      // Try to get user from database
      let dbUser;
      try {
        console.log('[UnifiedUser] Querying database for user by Supabase ID...');
        const result = await directClient.user.get.query({ supabaseId: authData.user.id });
        console.log('[UnifiedUser] Database query result:', { 
          success: result.success, 
          hasUser: !!result.user,
          userId: result.user?.id,
          email: result.user?.email 
        });
        
        if (result.success && result.user) {
          dbUser = result.user;
          console.log('[UnifiedUser] ✅ User found in database by Supabase ID');
        } else {
          // User not found in database, try by email
          console.log('[UnifiedUser] User not found by Supabase ID, trying by email...');
          const emailResult = await directClient.user.get.query({ email: authData.user.email || email });
          console.log('[UnifiedUser] Database query by email result:', { 
            success: emailResult.success, 
            hasUser: !!emailResult.user,
            userId: emailResult.user?.id 
          });
          
          if (emailResult.success && emailResult.user) {
            dbUser = emailResult.user;
            console.log('[UnifiedUser] ✅ User found in database by email');
            // Note: supabaseId update would need to be added to updateUserProcedure if needed
            // For now, we'll continue with the existing user
          } else {
            // User doesn't exist in database - create it
            console.log('[UnifiedUser] ⚠️ User not found in database, creating new user record...');
            try {
              const createPayload = {
                email: authData.user.email || email,
                name: authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || null,
                supabaseId: authData.user.id,
                revenueCatUserId: authData.user.email || email,
                isGuest: false,
              };
              console.log('[UnifiedUser] Creating user in database with payload:', {
                email: createPayload.email,
                hasName: !!createPayload.name,
                hasSupabaseId: !!createPayload.supabaseId,
              });
              
              const createResult = await directClient.user.create.mutate(createPayload);
              console.log('[UnifiedUser] User create result:', {
                success: createResult.success,
                hasUser: !!createResult.user,
                userId: createResult.user?.id,
              });
              
              if (createResult.success && createResult.user) {
                console.log('[UnifiedUser] ✅ User created in database successfully');
                // Fetch the newly created user
                const newUserResult = await directClient.user.get.query({ email: authData.user.email || email });
                if (newUserResult.success && newUserResult.user) {
                  dbUser = newUserResult.user;
                  console.log('[UnifiedUser] ✅ Verified newly created user in database');
                } else {
                  console.error('[UnifiedUser] ❌ Failed to retrieve newly created user:', newUserResult);
                  throw new Error('Failed to retrieve newly created user');
                }
              } else {
                console.error('[UnifiedUser] ❌ Failed to create user in database:', createResult);
                throw new Error('Failed to create user in database');
              }
            } catch (createError: any) {
              const errorMsg = createError?.message || String(createError);
              console.error('[UnifiedUser] ❌ Database creation error:', {
                message: errorMsg,
                error: createError,
                stack: createError?.stack,
              });
              
              // Check if it's a JSON parse error or network error
              if (errorMsg.includes('JSON Parse error') || 
                  errorMsg.includes('Unexpected character') ||
                  errorMsg.includes('invalid JSON') ||
                  errorMsg.includes('non-JSON') ||
                  errorMsg.includes('Network request failed') ||
                  errorMsg.includes('Failed to fetch')) {
                console.warn('[UnifiedUser] ⚠️ Backend connectivity issue during user creation. Continuing with Supabase auth only.');
              }
              
              // Don't throw - allow sign-in to continue with Supabase auth only
              // User can still use the app, data will sync when backend is available
              console.warn('[UnifiedUser] ⚠️ Continuing sign-in without database user (backend may be unavailable)');
            }
          }
        }
      } catch (getUserError: any) {
        const errorMsg = getUserError?.message || String(getUserError);
        console.error('[UnifiedUser] ❌ Error fetching user from database:', {
          message: errorMsg,
          error: getUserError,
          stack: getUserError?.stack,
        });
        
        // Check if it's a JSON parse error or network error
        const isJsonParseError = errorMsg.includes('JSON Parse error') || 
            errorMsg.includes('Unexpected character') ||
            errorMsg.includes('invalid JSON') ||
            errorMsg.includes('non-JSON') ||
            errorMsg.includes('Server returned non-JSON') ||
            errorMsg.includes('Server returned invalid JSON');
        const isNetworkError = errorMsg.includes('Network request failed') ||
            errorMsg.includes('Failed to fetch') ||
            errorMsg.includes('ECONNREFUSED') ||
            errorMsg.includes('ERR_NETWORK');
        
        if (isJsonParseError || isNetworkError) {
          console.warn('[UnifiedUser] ⚠️ Backend connectivity issue detected. Continuing sign-in with Supabase auth only.');
          console.warn('[UnifiedUser] ⚠️ Error type:', isJsonParseError ? 'JSON Parse Error' : 'Network Error');
        }
        
        // Don't throw - allow sign-in to continue with Supabase auth only
        // User can still use the app, data will sync when backend is available
        console.warn('[UnifiedUser] ⚠️ Continuing sign-in without database user (backend may be unavailable)');
      }
      
      // 4. Collect guest data for migration (including subscription)
      const guestData = await collectGuestData();
      console.log('[UnifiedUser] Guest data collected for migration (sign-in)');
      
      // 5. Check for local roadmap/goal data BEFORE any operations
      const localGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL);
      const localRoadmap = await AsyncStorage.getItem(STORAGE_KEYS.ROADMAP);
      const hasLocalData = !!(localGoal && localRoadmap);
      
      // 6. Create user object with subscription data FIRST (before restoring data)
      // This ensures subscription status is available for the restore function
      let userData: UnifiedUser;
      
      if (!dbUser) {
        console.warn('[UnifiedUser] ⚠️ No database user found, creating fallback user from Supabase + guest data');
        // Create fallback user from Supabase data + guest subscription data
        // This allows sign-in to work even if backend is unavailable
        userData = {
          id: authData.user.id,
          email: authData.user.email || email,
          name: authData.user.user_metadata?.name || null,
          username: null,
          profilePicture: guestData.profilePicture || null,
          mode: 'registered',
          isGuest: false,
          createdAt: new Date(),
          // Preserve guest subscription data
          subscriptionPlan: (guestData.subscriptionPlan || 'free') as any,
          subscriptionStatus: guestData.subscriptionStatus as any,
          subscriptionExpiresAt: guestData.subscriptionExpiresAt,
          subscriptionPurchasedAt: guestData.subscriptionPurchasedAt,
        };
        
        await saveUser(userData);
        console.log('[UnifiedUser] ✅ Created fallback user from Supabase + guest data');
        console.log('[UnifiedUser] Subscription preserved:', {
          plan: userData.subscriptionPlan,
          status: userData.subscriptionStatus,
        });
        console.log('[UnifiedUser] ⚠️ Note: Backend may be unavailable - data will sync when backend is available');
        
        // If we have local data, preserve it - don't clear
        if (hasLocalData) {
          console.log('[UnifiedUser] Local data exists - preserving it, not clearing');
          // Trigger reload to ensure ambition store has the data
          triggerAmbitionStoreReload();
        }
      } else {
        // Use database user data, but preserve guest subscription if database doesn't have it
        userData = {
          id: dbUser.id || authData.user.id,
          email: authData.user.email || dbUser.email || email || null, // CRITICAL: Prioritize email from current sign-in (source of truth)
          name: dbUser.name || null,
          username: dbUser.username || null,
          profilePicture: dbUser.profilePicture || guestData.profilePicture || null,
          mode: 'registered',
          isGuest: false,
          createdAt: dbUser.createdAt ? new Date(dbUser.createdAt) : new Date(),
          // Always prefer database subscription data, but fall back to guest data if database doesn't have it
          subscriptionPlan: (dbUser.subscriptionPlan || guestData.subscriptionPlan || 'free') as any,
          subscriptionStatus: (dbUser.subscriptionStatus || guestData.subscriptionStatus) as any,
          subscriptionExpiresAt: dbUser.subscriptionExpiresAt 
            ? new Date(dbUser.subscriptionExpiresAt) 
            : guestData.subscriptionExpiresAt,
          subscriptionPurchasedAt: dbUser.subscriptionPurchasedAt 
            ? new Date(dbUser.subscriptionPurchasedAt) 
            : guestData.subscriptionPurchasedAt,
        };
        
        // CRITICAL: Clear old user data first to prevent showing stale email
        console.log('[UnifiedUser] Clearing old user data before saving new user (sign-in):', {
          oldEmail: user?.email,
          newEmail: userData.email,
        });
        setUserInternal(null); // Clear state first
        
        // 7. Save user data to local storage FIRST (so restore function can check premium status)
        await saveUser(userData);
        console.log('[UnifiedUser] User data saved with subscription:', {
          email: userData.email,
          plan: userData.subscriptionPlan,
          status: userData.subscriptionStatus,
          expiresAt: userData.subscriptionExpiresAt,
          isLifetime: userData.subscriptionPlan === 'lifetime',
        });
        
        // 8. Check if user is premium
        const isLifetime = userData.subscriptionPlan === 'lifetime';
        const isMonthlyOrAnnual = userData.subscriptionPlan === 'monthly' || userData.subscriptionPlan === 'annual';
        const hasValidExpiration = !userData.subscriptionExpiresAt || userData.subscriptionExpiresAt > new Date();
        const isPremium = userData.subscriptionPlan && 
                         userData.subscriptionPlan !== 'free' &&
                         userData.subscriptionStatus === 'active' &&
                         (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));

        // 9. CRITICAL: Always restore server data if it exists, regardless of premium status
        // Premium check only applies to SYNCING (uploading), not RESTORING (downloading)
        const serverHasData = !!(dbUser.goal || dbUser.roadmap);
        
        console.log('[UnifiedUser] About to restore server data, dbUser:', {
          id: dbUser.id,
          email: dbUser.email,
          hasGoal: !!dbUser.goal,
          hasRoadmap: !!dbUser.roadmap,
          hasCompletedTasks: !!dbUser.completedTasks,
          subscriptionPlan: dbUser.subscriptionPlan,
          subscriptionStatus: dbUser.subscriptionStatus,
          goalLength: dbUser.goal?.length || 0,
          roadmapLength: dbUser.roadmap?.length || 0,
          isPremium,
          serverHasData,
          hasLocalData,
        });
        
        // CRITICAL: Always restore server data if it exists, regardless of premium status
        // Premium check only applies to SYNCING (uploading), not RESTORING (downloading)
        if (serverHasData) {
          console.log('[UnifiedUser] Server has data - restoring from server (regardless of premium status)');
          // Restore server data (this will also trigger ambition store reload and subscription restore)
          await restoreServerDataToLocal(dbUser);
        } else if (hasLocalData) {
          console.log('[UnifiedUser] No server data but local data exists - preserving local data');
          // Don't restore, keep local data - it will be synced later if user is premium
          // Trigger reload to ensure ambition store has the data
          triggerAmbitionStoreReload();
        } else {
          console.log('[UnifiedUser] No server data and no local data - user will start fresh');
          // Still restore subscription data even if no roadmap data
          await restoreServerDataToLocal(dbUser);
        }
      }
      
      // 10. Only clear guest data if we don't have local roadmap/goal data to preserve
      // OR if we successfully restored from server
      if (guestData && !hasLocalData && dbUser && dbUser.goal && dbUser.roadmap) {
        console.log('[UnifiedUser] Server data restored, clearing guest data');
        await clearGuestData();
      } else if (guestData && hasLocalData) {
        console.log('[UnifiedUser] Local data exists - preserving it, not clearing guest data');
        // Don't clear - we want to keep the local roadmap/goal
      }
      
      // 11. Trigger initial sync for premium users ONLY if we have local data that might differ from server
      // Don't sync immediately after restore - wait for store to hydrate and only sync if we have local changes
      const isLifetime = userData.subscriptionPlan === 'lifetime';
      const isMonthlyOrAnnual = userData.subscriptionPlan === 'monthly' || userData.subscriptionPlan === 'annual';
      const hasValidExpiration = !userData.subscriptionExpiresAt || userData.subscriptionExpiresAt > new Date();
      const isPremium = userData.subscriptionPlan && 
                       userData.subscriptionPlan !== 'free' &&
                       userData.subscriptionStatus === 'active' &&
                       (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));
      
      if (isPremium && hasLocalData && !serverHasData) {
        console.log('[UnifiedUser] Premium user with local data (no server data), will sync after store hydrates...');
        // Wait longer to ensure store is hydrated before syncing
        setTimeout(() => {
          try {
            DeviceEventEmitter.emit('ambition-sync-trigger', { forceSync: true, isPremium: true });
            console.log('[UnifiedUser] ✅ Emitted sync event for premium user with local data');
          } catch (e) {
            console.warn('[UnifiedUser] Could not emit sync event:', e);
          }
        }, 3000); // Increased delay to ensure store is hydrated
      } else if (isPremium && serverHasData) {
        console.log('[UnifiedUser] Premium user with server data restored - skipping immediate sync to prevent data loss');
        // Don't sync immediately after restore - the data is already in the database
      }
      
      console.log('[UnifiedUser] ✅ Sign in complete');
      console.log('[UnifiedUser] Sign-in summary:', {
        hasDatabaseUser: !!dbUser,
        userId: userData.id,
        email: userData.email,
        isGuest: userData.isGuest,
        subscriptionPlan: userData.subscriptionPlan,
        hasSupabaseSession: !!authData.session,
        supabaseUserId: authData.user.id,
      });
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('[UnifiedUser] Sign in error:', error);
      // Provide more helpful error messages
      if (error instanceof Error) {
        const errorMessage = error.message || '';
        
        // Check for JSON parse errors first
        if (errorMessage.includes('JSON Parse error') || 
            errorMessage.includes('Unexpected character') ||
            errorMessage.includes('invalid JSON') ||
            errorMessage.includes('non-JSON') ||
            errorMessage.includes('Server returned non-JSON') ||
            errorMessage.includes('Server returned invalid JSON')) {
          console.error('[UnifiedUser] Backend returned non-JSON response. This usually means the backend server is not running or returned an error page.');
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        
        // Supabase error messages
        if (errorMessage.includes('Email not confirmed')) {
          throw new Error('Please confirm your email address before signing in. Check your inbox for the verification link.');
        } else if (errorMessage.includes('Invalid login credentials') || 
            errorMessage.includes('Invalid credentials') ||
            errorMessage.includes('email or password') ||
            errorMessage.includes('Wrong email or password')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (errorMessage.includes('User data not found') || 
                   errorMessage.includes('not found in database')) {
          throw new Error('Account not found. Please sign up first.');
        } else if (errorMessage.includes('Network') || 
                   errorMessage.includes('fetch') || 
                   errorMessage.includes('Failed to fetch') ||
                   errorMessage.includes('ECONNREFUSED')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else if (errorMessage.includes('Backend is running') || 
                   errorMessage.includes('API URL')) {
          throw new Error('Unable to connect to the server. Please try again later.');
        } else {
          // Use the original error message if it exists, otherwise provide a generic one
          throw new Error(errorMessage || 'Failed to sign in. Please try again.');
        }
      } else {
        // If error is not an Error instance, create one with a message
        const errorMessage = typeof error === 'string' ? error : 'Failed to sign in. Please try again.';
        throw new Error(errorMessage);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  // Sign out: Convert to guest user
  const signOut = useCallback(async () => {
    try {
      console.log('[UnifiedUser] Signing out...');
      
      // 1. Sync data to database BEFORE signing out (if user is premium)
      // This ensures data is saved to the cloud before clearing local account data
      try {
        const currentUser = user;
        if (currentUser && !currentUser.isGuest) {
          const isLifetime = currentUser.subscriptionPlan === 'lifetime';
          const isMonthlyOrAnnual = currentUser.subscriptionPlan === 'monthly' || currentUser.subscriptionPlan === 'annual';
          const hasValidExpiration = !currentUser.subscriptionExpiresAt || currentUser.subscriptionExpiresAt > new Date();
          const isPremium = currentUser.subscriptionPlan && 
                           currentUser.subscriptionPlan !== 'free' &&
                           currentUser.subscriptionStatus === 'active' &&
                           (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));
          
          if (isPremium && currentUser.email) {
            console.log('[UnifiedUser] Premium user signing out - syncing data to database first...');
            try {
              const { DeviceEventEmitter } = require('react-native');
              DeviceEventEmitter.emit('ambition-sync-trigger');
              // Wait a bit for sync to complete
              await new Promise(resolve => setTimeout(resolve, 1000));
              console.log('[UnifiedUser] Data sync triggered before sign out');
            } catch (syncError) {
              console.warn('[UnifiedUser] Failed to sync data before sign out:', syncError);
            }
          }
        }
      } catch (syncError) {
        console.warn('[UnifiedUser] Error syncing before sign out:', syncError);
      }

      // 2. Clear ALL data from AsyncStorage (including roadmap/goal data)
      // When user signs out, they should start fresh as a guest
      // CRITICAL: Clear subscription state - it should be tied to account, not device
      console.log('[UnifiedUser] Clearing all user data from storage (including roadmap/goal)...');
      await Promise.all([
        // Clear unified user data
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.GUEST_ID),
        // Clear roadmap/goal data - user signs out to start fresh
        AsyncStorage.removeItem(STORAGE_KEYS.GOAL),
        AsyncStorage.removeItem(STORAGE_KEYS.TIMELINE),
        AsyncStorage.removeItem(STORAGE_KEYS.TIME_COMMITMENT),
        AsyncStorage.removeItem(STORAGE_KEYS.ANSWERS),
        AsyncStorage.removeItem(STORAGE_KEYS.ROADMAP),
        AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS),
        // Clear subscription state - subscription is tied to account, not device
        AsyncStorage.removeItem('ambitionly_subscription_state'),
        // Clear auth tokens from auth-store
        AsyncStorage.removeItem('ambitionly_auth_token'),
        AsyncStorage.removeItem('ambitionly_user_email'),
        AsyncStorage.removeItem('ambitionly_user_id'),
        // Clear old user-store data if it exists
        AsyncStorage.removeItem('ambitionly_user'),
      ]);
      
      // 3. Reset internal state immediately
      setUserInternal(null);
      
      // 4. Sign out from Supabase multiple times to ensure session is fully cleared
      // Supabase stores sessions in SecureStore, so we need to be thorough
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.warn(`[UnifiedUser] Supabase sign out error (attempt ${attempts + 1}):`, signOutError);
        }
        
        // Wait for session to clear
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify session is cleared
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[UnifiedUser] Supabase session cleared successfully');
          break;
        } else {
          attempts++;
          console.warn(`[UnifiedUser] Session still exists after sign out (attempt ${attempts}/${maxAttempts})`);
          if (attempts < maxAttempts) {
            // Try clearing SecureStore directly if available
            try {
              const { Platform } = require('react-native');
              if (Platform.OS !== 'web') {
                const SecureStore = require('expo-secure-store');
                // Supabase stores session in a key like 'supabase.auth.token'
                // Try to clear common Supabase storage keys
                const supabaseKeys = [
                  'supabase.auth.token',
                  'sb-auth-token',
                  'supabase.auth.token.anonymous',
                ];
                for (const key of supabaseKeys) {
                  try {
                    await SecureStore.deleteItemAsync(key);
                  } catch (e) {
                    // Key might not exist, ignore
                  }
                }
              }
            } catch (secureStoreError) {
              console.warn('[UnifiedUser] Could not clear SecureStore directly:', secureStoreError);
            }
          }
        }
      }
      
      // Final verification
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      if (finalSession) {
        console.error('[UnifiedUser] ⚠️ WARNING: Supabase session still exists after all sign out attempts');
      }
      
      // 5. Logout from RevenueCat
      try {
        await Purchases.logOut();
        console.log('[UnifiedUser] RevenueCat logged out');
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat logout failed:', rcError);
      }
      
      // 6. Create fresh guest user with new ID
      const newGuestId = generateGuestId();
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_ID, newGuestId);
      
      const guestUser: UnifiedUser = {
        id: newGuestId,
        email: null,
        name: null,
        username: null,
        profilePicture: null,
        mode: 'guest',
        isGuest: true,
        createdAt: new Date(),
        subscriptionPlan: 'free',
        subscriptionStatus: null,
        subscriptionExpiresAt: null,
        subscriptionPurchasedAt: null,
      };
      
      setUserInternal(guestUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(guestUser));
      
      // 7. Clear ambition store in-memory state - user signs out to start fresh
      DeviceEventEmitter.emit('ambition-clear-all');
      console.log('[UnifiedUser] Clearing roadmap/goal data from ambition store');
      
      // 8. Clear subscription store state - subscription is tied to account
      DeviceEventEmitter.emit('subscription-clear');
      console.log('[UnifiedUser] Emitted subscription-clear event');
      
      // 9. Emit sign-out event to reset navigation state in splash screen
      DeviceEventEmitter.emit('user-signed-out');
      console.log('[UnifiedUser] Emitted user-signed-out event');
      
      // 9. Wait a bit more to ensure all state is cleared before navigation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[UnifiedUser] ✅ Signed out, fresh guest session created');
    } catch (error) {
      console.error('[UnifiedUser] Sign out error:', error);
      throw error;
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates: {
    name?: string;
    username?: string;
    profilePicture?: string;
  }) => {
    if (!user) throw new Error('No user session');
    
    const updatedUser: UnifiedUser = {
      ...user,
      ...updates,
    };
    
    await saveUser(updatedUser);
    
    // Sync to database if registered
    if (!user.isGuest) {
      await syncToDatabase(updatedUser);
    }
    
    console.log('[UnifiedUser] Profile updated');
  }, [user]);

  // Update subscription data
  const updateSubscription = useCallback(async (subscriptionData: {
    plan: UnifiedUser['subscriptionPlan'];
    status: UnifiedUser['subscriptionStatus'];
    expiresAt: Date | null;
    purchasedAt: Date | null;
  }) => {
    if (!user) throw new Error('No user session');
    
    // Check if user is upgrading to premium (was free/inactive, now premium/active)
    const wasPremium = user.subscriptionPlan && 
                      user.subscriptionPlan !== 'free' &&
                      user.subscriptionStatus === 'active' &&
                      (!user.subscriptionExpiresAt || user.subscriptionExpiresAt > new Date());
    
    const isNowPremium = subscriptionData.plan && 
                        subscriptionData.plan !== 'free' &&
                        subscriptionData.status === 'active' &&
                        (!subscriptionData.expiresAt || subscriptionData.expiresAt > new Date());
    
    const justBecamePremium = !wasPremium && isNowPremium;
    
    const updatedUser: UnifiedUser = {
      ...user,
      subscriptionPlan: subscriptionData.plan,
      subscriptionStatus: subscriptionData.status,
      subscriptionExpiresAt: subscriptionData.expiresAt,
      subscriptionPurchasedAt: subscriptionData.purchasedAt,
    };
    
    await saveUser(updatedUser);
    
    // Also update subscription store's AsyncStorage to keep it in sync
    try {
      const subscriptionState = {
        plan: subscriptionData.plan,
        isActive: subscriptionData.status === 'active',
        expiresAt: subscriptionData.expiresAt || undefined,
        purchasedAt: subscriptionData.purchasedAt || undefined,
      };
      await AsyncStorage.setItem('ambitionly_subscription_state', JSON.stringify(subscriptionState));
      console.log('[UnifiedUser] ✅ Subscription store updated');
    } catch (subError) {
      console.warn('[UnifiedUser] Failed to update subscription store:', subError);
    }
    
    // Sync to database if registered (always sync subscription data)
    if (!user.isGuest) {
      await syncToDatabase(updatedUser);
    }
    
    // If user just became premium, trigger ambition data sync
    if (justBecamePremium && !user.isGuest) {
      console.log('[UnifiedUser] User just became premium, triggering ambition data sync...');
      // Use event emitter to trigger sync in ambition store
      setTimeout(() => {
        try {
          DeviceEventEmitter.emit('ambition-sync-trigger');
          console.log('[UnifiedUser] ✅ Triggered ambition data sync');
        } catch (error) {
          console.warn('[UnifiedUser] Failed to trigger ambition sync:', error);
        }
      }, 500); // Small delay to ensure user state is saved
    }
    
    console.log('[UnifiedUser] Subscription updated');
  }, [user]);

  // Sync user data to database
  // CRITICAL: This function ONLY syncs subscription and profile data, NOT roadmap/goal data
  // Roadmap/goal data is synced separately via ambition-store.tsx and ONLY for premium users
  const syncToDatabase = async (userData: UnifiedUser) => {
    if (userData.isGuest) {
      console.log('[UnifiedUser] Skipping database sync for guest user');
      return;
    }
    
    // Check if user has premium subscription (for reference only - not used for sync decision)
    const hasPremium = userData.subscriptionPlan && 
                      userData.subscriptionPlan !== 'free' &&
                      userData.subscriptionStatus === 'active' &&
                      (!userData.subscriptionExpiresAt || userData.subscriptionExpiresAt > new Date());
    
    // CRITICAL: Always sync subscription data to database, regardless of premium status
    // This ensures subscription status is tied to account, not device
    // NOTE: We do NOT sync roadmap/goal data here - that's handled by ambition-store.tsx
    // and ONLY for premium users
    try {
      console.log('[UnifiedUser] Syncing subscription data to database (NOT roadmap data):', {
        email: userData.email,
        plan: userData.subscriptionPlan,
        status: userData.subscriptionStatus,
        hasPremium,
        expiresAt: userData.subscriptionExpiresAt,
        purchasedAt: userData.subscriptionPurchasedAt,
      });
      
      const syncPayload = {
        email: userData.email!,
        name: userData.name || undefined,
        username: userData.username || undefined,
        profilePicture: userData.profilePicture || undefined,
        // Always sync subscription data - this is account-level data
        subscriptionPlan: userData.subscriptionPlan,
        subscriptionStatus: userData.subscriptionStatus,
        subscriptionExpiresAt: userData.subscriptionExpiresAt?.toISOString(),
        subscriptionPurchasedAt: userData.subscriptionPurchasedAt?.toISOString(),
        // CRITICAL: Do NOT include roadmap/goal data here - that's synced separately
        // via ambition-store.tsx and ONLY for premium users
      };
      
      console.log('[UnifiedUser] Sync payload:', {
        email: syncPayload.email,
        hasName: !!syncPayload.name,
        subscriptionPlan: syncPayload.subscriptionPlan,
        subscriptionStatus: syncPayload.subscriptionStatus,
      });
      
      const result = await updateUserMutation.mutateAsync(syncPayload);
      
      console.log('[UnifiedUser] ✅ Subscription data synced to database:', {
        success: result.success,
        userId: result.user?.id,
        email: result.user?.email,
        updatedAt: result.user?.updatedAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[UnifiedUser] ❌ Database sync error:', {
        message: errorMessage,
        stack: errorStack,
        error: error,
        email: userData.email,
      });
      
      // Log more details about the error
      if (errorMessage.includes('Network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        console.error('[UnifiedUser] Network error - backend may be unreachable');
      } else if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        console.error('[UnifiedUser] JSON parsing error - backend may have returned invalid response');
      } else if (errorMessage.includes('User not found') || errorMessage.includes('not found')) {
        console.error('[UnifiedUser] User not found in database - user may need to be created first');
      } else {
        console.error('[UnifiedUser] Unknown sync error - check backend logs');
      }
      
      // Don't throw - local data is still saved
    }
  };

  return useMemo(() => ({
    isHydrated,
    user,
    isGuest: user?.isGuest ?? true,
    isRegistered: user ? !user.isGuest : false,
    isAuthenticating,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    updateProfile,
    updateSubscription,
    syncToDatabase: () => user && !user.isGuest ? syncToDatabase(user) : Promise.resolve(),
  }), [
    isHydrated,
    user,
    isAuthenticating,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    updateProfile,
    updateSubscription,
  ]);
});



