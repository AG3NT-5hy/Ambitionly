/**
 * Unified User Store
 * Handles both guest users (local storage) and registered users (database)
 */

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
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

const createBackendClient = () => {
  const baseUrl = config.API_URL;
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpLink({
        url: `${baseUrl}/api/trpc`,
        fetch: async (url, options) => {
          try {
            const response = await fetch(url, {
              ...options,
              headers: {
                ...options?.headers,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              console.error('[UnifiedUser] Request failed:', response.status, response.statusText);
              const errorClone = response.clone();
              const errorText = await errorClone.text().catch(() => 'Unknown error');
              console.error('[UnifiedUser] Error response:', errorText);
            }

            return response;
          } catch (error) {
            console.error('[UnifiedUser] Fetch error:', error);
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

  // Use tRPC hooks for mutations
  const signupMutation = trpc.auth.signup.useMutation();
  const confirmSupabaseUserMutation = trpc.auth.confirmSupabaseUser.useMutation();
  const createUserMutation = trpc.user.create.useMutation();
  const updateUserMutation = trpc.user.update.useMutation();

  // Load user on init
  useEffect(() => {
    loadUser();
  }, []);

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
        console.warn('[UnifiedUser] Error fetching user from backend after Google sign-in:', getUserError);
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
          console.warn('[UnifiedUser] user.create mutation failed, attempting direct client fallback:', createError);
          try {
            await directClient.user.create.mutate(createPayload);
            createdUser = true;
            console.log('[UnifiedUser] ✅ Created user from Google sign-in guest data via direct client fallback');
          } catch (directCreateError) {
            createdUser = false;
            console.error('[UnifiedUser] Failed to create user from Google sign-in via direct client:', directCreateError);
            console.warn('[UnifiedUser] Continuing with local fallback user after Google sign-in failure.');
          }
        }

        if (createdUser) {
          try {
            const newUserResult = await directClient.user.get.query({ email });
            if (newUserResult.success && newUserResult.user) {
              dbUser = newUserResult.user;
            }
          } catch (postCreateError) {
            console.warn('[UnifiedUser] Unable to fetch user after creation:', postCreateError);
          }
        }
      }

      if (dbUser) {
        if (createdUser && !guestData) {
          guestData = await collectGuestData();
        }

        if (!createdUser) {
          await restoreServerDataToLocal(dbUser);
        }

        const userData: UnifiedUser = createdUser && guestData ? {
          id: dbUser.id || authUser.id,
          email: dbUser.email || email,
          name: dbUser.name || authUser.user_metadata?.name || null,
          username: dbUser.username || null,
          profilePicture: guestData.profilePicture || dbUser.profilePicture || authUser.user_metadata?.picture || null,
          mode: 'registered',
          isGuest: false,
          createdAt: dbUser.createdAt ? new Date(dbUser.createdAt) : new Date(),
          subscriptionPlan: guestData.subscriptionPlan as any,
          subscriptionStatus: guestData.subscriptionStatus as any,
          subscriptionExpiresAt: guestData.subscriptionExpiresAt,
          subscriptionPurchasedAt: guestData.subscriptionPurchasedAt,
        } : {
          id: dbUser.id || authUser.id,
          email: dbUser.email || email,
          name: dbUser.name || authUser.user_metadata?.name || null,
          username: dbUser.username || null,
          profilePicture: dbUser.profilePicture || authUser.user_metadata?.picture || null,
          mode: 'registered',
          isGuest: false,
          createdAt: dbUser.createdAt ? new Date(dbUser.createdAt) : new Date(),
          subscriptionPlan: (dbUser.subscriptionPlan || 'free') as any,
          subscriptionStatus: dbUser.subscriptionStatus as any,
          subscriptionExpiresAt: dbUser.subscriptionExpiresAt ? new Date(dbUser.subscriptionExpiresAt) : null,
          subscriptionPurchasedAt: dbUser.subscriptionPurchasedAt ? new Date(dbUser.subscriptionPurchasedAt) : null,
        };

        await saveUser(userData);
      } else {
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
      }

      if (guestData) {
        await clearGuestData();
      }

      console.log('[UnifiedUser] ✅ Google sign-in complete');
      return true;
    } catch (error) {
      console.error('[UnifiedUser] Google sign-in error:', error);
      if (error instanceof Error) {
        throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
      }
      throw new Error('Failed to sign in with Google. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [createUserMutation]);

  const loadUser = async () => {
    try {
      // Check if we have a stored user
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Convert date strings back to dates
        if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
        if (parsed.subscriptionExpiresAt) parsed.subscriptionExpiresAt = new Date(parsed.subscriptionExpiresAt);
        if (parsed.subscriptionPurchasedAt) parsed.subscriptionPurchasedAt = new Date(parsed.subscriptionPurchasedAt);
        
        setUserInternal(parsed);
      } else {
        // Create guest user
        await createGuestUser();
      }
    } catch (error) {
      console.error('[UnifiedUser] Error loading user:', error);
      await createGuestUser();
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

  // Restore server data to local storage
  const restoreServerDataToLocal = async (dbUser: any) => {
    try {
      console.log('[UnifiedUser] Restoring server data to local storage...');
      
      const restorePromises: Promise<void>[] = [];
      
      // Restore goal and roadmap data
      if (dbUser.goal) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.GOAL, dbUser.goal));
      }
      if (dbUser.timeline) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TIMELINE, dbUser.timeline));
      }
      if (dbUser.timeCommitment) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TIME_COMMITMENT, dbUser.timeCommitment));
      }
      if (dbUser.answers) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.ANSWERS, dbUser.answers));
      }
      if (dbUser.roadmap) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, dbUser.roadmap));
      }
      if (dbUser.completedTasks) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, dbUser.completedTasks));
      }
      if (dbUser.streakData) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, dbUser.streakData));
      }
      if (dbUser.taskTimers) {
        restorePromises.push(AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, dbUser.taskTimers));
      }
      
      await Promise.all(restorePromises);
      console.log('[UnifiedUser] ✅ Server data restored to local storage');
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
        
        // If it's a network error, we'll fall back to Supabase signup
        // If it's "user already exists", we'll try to sign in with Supabase
        if (errorMessage.includes('already registered') || errorMessage.includes('Email already')) {
          console.log('[UnifiedUser] User already exists in backend, attempting sign in with Supabase...');
          // Try to sign in with Supabase to get the user ID
          try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (signInError) {
              // If sign in fails, try creating with Supabase directly
              console.log('[UnifiedUser] Supabase sign in failed, will create user directly:', signInError);
            } else if (signInData.user) {
              supabaseUserId = signInData.user.id;
              backendSignupSucceeded = true; // User exists, continue with flow
              console.log('[UnifiedUser] ✅ Signed in with existing Supabase user');
            }
          } catch (signInErr) {
            console.warn('[UnifiedUser] Error during Supabase sign in:', signInErr);
            // Continue to create user directly
          }
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
          console.warn('[UnifiedUser] Backend confirm endpoint failed, falling back to direct Supabase signup:', confirmError);
          const confirmMessage = confirmError?.message || String(confirmError);
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
                authError.message.includes('already registered')) {
              // User exists in Supabase, try to sign in
              console.log('[UnifiedUser] User exists in Supabase, attempting sign in...');
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (signInError) {
                throw new Error('This email is already registered. Please sign in instead, or check your password.');
              }
              
              if (signInData.user) {
                supabaseUserId = signInData.user.id;
                console.log('[UnifiedUser] ✅ Signed in with existing Supabase user');
              } else {
                throw new Error('Failed to sign in with existing account');
              }
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
          await createUserMutation.mutateAsync(createPayload);
          console.log('[UnifiedUser] ✅ User created in database with guest data via mutation');
        } catch (dbError) {
          console.warn('[UnifiedUser] user.create mutation failed during sign up, attempting direct client fallback:', dbError);
          try {
            await directClient.user.create.mutate(createPayload);
            console.log('[UnifiedUser] ✅ User created in database with guest data via direct client fallback');
          } catch (directDbError) {
            console.warn('[UnifiedUser] Database creation error (non-critical):', directDbError);
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
      
      // Try to get user from database
      let dbUser;
      try {
        const result = await directClient.user.get.query({ supabaseId: authData.user.id });
        if (result.success && result.user) {
          dbUser = result.user;
        } else {
          // User not found in database, try by email
          const emailResult = await directClient.user.get.query({ email: authData.user.email || email });
          if (emailResult.success && emailResult.user) {
            dbUser = emailResult.user;
            // Note: supabaseId update would need to be added to updateUserProcedure if needed
            // For now, we'll continue with the existing user
          } else {
            // User doesn't exist in database - create it
            console.log('[UnifiedUser] User not found in database, creating...');
            try {
              const createResult = await directClient.user.create.mutate({
                email: authData.user.email || email,
                name: authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || null,
                supabaseId: authData.user.id,
                revenueCatUserId: authData.user.email || email,
                isGuest: false,
              });
              if (createResult.success && createResult.user) {
                // Fetch the newly created user
                const newUserResult = await directClient.user.get.query({ email: authData.user.email || email });
                if (newUserResult.success && newUserResult.user) {
                  dbUser = newUserResult.user;
                } else {
                  throw new Error('Failed to retrieve newly created user');
                }
              } else {
                throw new Error('Failed to create user in database');
              }
            } catch (createError) {
              console.error('[UnifiedUser] Failed to create user in database:', createError);
              throw new Error('User account not found. Please sign up first.');
            }
          }
        }
      } catch (getUserError) {
        console.error('[UnifiedUser] Error fetching user from database:', getUserError);
        throw new Error('Failed to load user data. Please try again.');
      }
      
      if (!dbUser) {
        throw new Error('User data not found in database');
      }
      
      // 4. Restore server data to local storage
      await restoreServerDataToLocal(dbUser);
      
      // 5. Create user object
      const userData: UnifiedUser = {
        id: dbUser.id || authData.user.id,
        email: dbUser.email || authData.user.email || null,
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
      
      // 6. Save to local storage
      await saveUser(userData);
      
      console.log('[UnifiedUser] ✅ Sign in complete, server data restored to local storage');
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('[UnifiedUser] Sign in error:', error);
      // Provide more helpful error messages
      if (error instanceof Error) {
        // Supabase error messages
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please confirm your email address before signing in. Check your inbox for the verification link.');
        } else if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Invalid credentials') ||
            error.message.includes('email or password') ||
            error.message.includes('Wrong email or password')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('User data not found') || 
                   error.message.includes('not found in database')) {
          throw new Error('Account not found. Please sign up first.');
        } else if (error.message.includes('Network') || 
                   error.message.includes('fetch') || 
                   error.message.includes('Failed to fetch') ||
                   error.message.includes('ECONNREFUSED')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else {
          // Use the original error message if it exists, otherwise provide a generic one
          throw new Error(error.message || 'Failed to sign in. Please try again.');
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
      
      // 1. Sign out from Supabase
      await supabase.auth.signOut();
      
      // 2. Logout from RevenueCat
      try {
        await Purchases.logOut();
        console.log('[UnifiedUser] RevenueCat logged out');
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat logout failed:', rcError);
      }
      
      // 3. Create new guest user
      await createGuestUser();
      
      console.log('[UnifiedUser] ✅ Signed out, new guest session created');
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
    
    const updatedUser: UnifiedUser = {
      ...user,
      subscriptionPlan: subscriptionData.plan,
      subscriptionStatus: subscriptionData.status,
      subscriptionExpiresAt: subscriptionData.expiresAt,
      subscriptionPurchasedAt: subscriptionData.purchasedAt,
    };
    
    await saveUser(updatedUser);
    
    // Sync to database if registered
    if (!user.isGuest) {
      await syncToDatabase(updatedUser);
    }
    
    console.log('[UnifiedUser] Subscription updated');
  }, [user]);

  // Sync user data to database
  const syncToDatabase = async (userData: UnifiedUser) => {
    if (userData.isGuest) {
      console.log('[UnifiedUser] Skipping database sync for guest user');
      return;
    }
    
    try {
      console.log('[UnifiedUser] Syncing to database:', userData.email);
      
      await updateUserMutation.mutateAsync({
        email: userData.email!,
        name: userData.name,
        username: userData.username,
        profilePicture: userData.profilePicture,
        subscriptionPlan: userData.subscriptionPlan,
        subscriptionStatus: userData.subscriptionStatus,
        subscriptionExpiresAt: userData.subscriptionExpiresAt?.toISOString(),
        subscriptionPurchasedAt: userData.subscriptionPurchasedAt?.toISOString(),
      });
      
      console.log('[UnifiedUser] ✅ Synced to database');
    } catch (error) {
      console.error('[UnifiedUser] Database sync error:', error);
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

