/**
 * Unified User Store
 * Handles both guest users (local storage) and registered users (database)
 */

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from './supabase';
import { trpc } from './trpc';
import { collectGuestData, clearGuestData, backupGuestData } from './user-data-migration';
import { STORAGE_KEYS } from '../constants';

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

  // Load user on init
  useEffect(() => {
    loadUser();
  }, []);

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
    if (!user) throw new Error('No user session');
    
    setIsAuthenticating(true);
    
    try {
      console.log('[UnifiedUser] Starting sign up for:', email);
      
      // 1. Create Supabase account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');
      
      // 2. Set RevenueCat user ID to email
      try {
        await Purchases.logIn(email);
        console.log('[UnifiedUser] RevenueCat user set to:', email);
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat login failed:', rcError);
      }
      
      // 3. Collect guest data for migration
      const guestData = await collectGuestData();
      console.log('[UnifiedUser] Guest data collected for migration');
      
      // 4. Create user in database with guest data
      try {
        await trpc.user.create.mutate({
          email,
          name,
          supabaseId: authData.user.id,
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
        });
        console.log('[UnifiedUser] ✅ User created in database with guest data');
      } catch (dbError) {
        console.error('[UnifiedUser] Database creation error:', dbError);
        // Continue anyway - data is in Supabase
      }
      
      // 5. Create registered user object
      const registeredUser: UnifiedUser = {
        id: authData.user.id,
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
      
      // 6. Save to local storage
      await saveUser(registeredUser);
      
      // 7. Clear old guest data
      await clearGuestData();
      
      console.log('[UnifiedUser] ✅ Sign up complete, guest data migrated');
      
      return { success: true, user: registeredUser };
    } catch (error) {
      console.error('[UnifiedUser] Sign up error:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [user]);

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
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Authentication failed');
      
      // 2. Set RevenueCat user ID
      try {
        await Purchases.logIn(email);
        console.log('[UnifiedUser] RevenueCat user set to:', email);
      } catch (rcError) {
        console.warn('[UnifiedUser] RevenueCat login failed:', rcError);
      }
      
      // 3. Fetch user data from database
      const result = await trpc.user.get.query({ supabaseId: authData.user.id });
      
      if (!result.success || !result.user) {
        throw new Error('User data not found in database');
      }
      
      const dbUser = result.user;
      
      // 4. Restore server data to local storage
      await restoreServerDataToLocal(dbUser);
      
      // 5. Create user object
      const userData: UnifiedUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        username: dbUser.username,
        profilePicture: dbUser.profilePicture,
        mode: 'registered',
        isGuest: false,
        createdAt: new Date(dbUser.createdAt),
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
      throw error;
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
      
      await trpc.user.update.mutate({
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
    updateProfile,
    updateSubscription,
  ]);
});

