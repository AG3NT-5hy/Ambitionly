import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { httpRequest } from '@/lib/http';
import { useUi } from '@/providers/UiProvider';
import { AppError } from '@/lib/errors';
import { NotificationService } from '@/lib/notifications';
import { analytics } from '@/lib/analytics';
import { trpc } from '@/lib/trpc';

export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
}

export interface TaskTimer {
  taskId: string;
  startTime: number;
  duration: number; // in minutes
  isActive: boolean;
  isCompleted: boolean;
  notificationId?: string | null; // ID of scheduled notification
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  milestones: Milestone[];
}

export interface Roadmap {
  id: string;
  goal: string;
  timeline: string;
  timeCommitment: string;
  phases: Phase[];
  createdAt: Date;
}

const STORAGE_KEYS = {
  GOAL: 'ambitionly_goal',
  TIMELINE: 'ambitionly_timeline',
  TIME_COMMITMENT: 'ambitionly_time_commitment',
  ANSWERS: 'ambitionly_answers',
  ROADMAP: 'ambitionly_roadmap',
  COMPLETED_TASKS: 'ambitionly_completed_tasks',
  STREAK_DATA: 'ambitionly_streak_data',
  TASK_TIMERS: 'ambitionly_task_timers',
};

export const [AmbitionProvider, useAmbition] = createContextHook(() => {
  const { showToast } = useUi();
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [goal, setGoalState] = useState<string>('');
  const [timeline, setTimelineState] = useState<string>('');
  const [timeCommitment, setTimeCommitmentState] = useState<string>('');
  const [answers, setAnswersState] = useState<string[]>([]);
  const [roadmap, setRoadmapState] = useState<Roadmap | null>(null);
  const [completedTasks, setCompletedTasksState] = useState<string[]>([]);
  const [streakData, setStreakDataState] = useState<{ lastCompletionDate: string; streak: number }>({
    lastCompletionDate: '',
    streak: 0,
  });
  const [taskTimers, setTaskTimersState] = useState<TaskTimer[]>([]);
  const previousTimerStates = useRef<Map<string, boolean>>(new Map());
  const notificationSentRef = useRef<Set<string>>(new Set());
  const isGeneratingRoadmapRef = useRef(false);
  const syncInProgressRef = useRef(false);
  const lastSyncTimeRef = useRef<number>(0);
  const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // tRPC mutation for syncing data (must be at hook level)
  const updateUserMutation = trpc.user.update.useMutation();
  
  // Get user info for syncing (we'll check if user is registered and has premium)
  // Note: We can't use useUnifiedUser here directly due to hook rules, so we'll check via Supabase session and AsyncStorage
  const checkUserSession = async (): Promise<{ email: string | null; isRegistered: boolean; hasPremium: boolean }> => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        return { email: null, isRegistered: false, hasPremium: false };
      }
      
      // Check subscription status from unified user store
      const { STORAGE_KEYS } = await import('@/constants');
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          // Handle all premium plans: monthly, annual, lifetime
          // Lifetime plans don't have expiration dates, so handle them specially
          // Monthly and annual plans need valid expiration dates
          const isLifetime = userData.subscriptionPlan === 'lifetime';
          const isMonthlyOrAnnual = userData.subscriptionPlan === 'monthly' || userData.subscriptionPlan === 'annual';
          const hasValidExpiration = !userData.subscriptionExpiresAt || new Date(userData.subscriptionExpiresAt) > new Date();
          const hasPremium = userData.subscriptionPlan && 
                            userData.subscriptionPlan !== 'free' &&
                            userData.subscriptionStatus === 'active' &&
                            (isLifetime || (isMonthlyOrAnnual && hasValidExpiration));
          
          return {
            email: session.user.email,
            isRegistered: true,
            hasPremium: hasPremium || false,
          };
        } catch (e) {
          console.warn('[Ambition] Failed to parse user data for premium check:', e);
        }
      }
      
      return {
        email: session.user.email,
        isRegistered: true,
        hasPremium: false,
      };
    } catch (error) {
      return { email: null, isRegistered: false, hasPremium: false };
    }
  };
  
  // Sync ambition data to database (ONLY for premium users)
  // CRITICAL: Roadmap/goal data is ONLY saved to database if user has premium subscription
  // Non-premium users' data stays local only
  const syncAmbitionDataToDatabase = useCallback(async (forceSync: boolean = false, isPremiumFromEvent: boolean | undefined = undefined, retryCount: number = 0) => {
    // Prevent concurrent syncs (unless forced and retrying)
    if (syncInProgressRef.current && !(forceSync && retryCount > 0)) {
      console.log('[Ambition] Sync already in progress, skipping');
      return;
    }
    
    // Don't sync if app is in background (unless forced)
    if (!forceSync && appStateRef.current !== 'active') {
      console.log('[Ambition] App not active, skipping sync');
      return;
    }
    
    try {
      console.log('[Ambition] 🔄 Starting sync to database...', { forceSync, isPremiumFromEvent, retryCount });
      const userSession = await checkUserSession();
      
      console.log('[Ambition] User session check result:', {
        isRegistered: userSession.isRegistered,
        email: userSession.email ? `${userSession.email.substring(0, 5)}...` : 'none',
        hasPremium: userSession.hasPremium,
      });
      
      if (!userSession.isRegistered || !userSession.email) {
        console.log('[Ambition] ⚠️ User not registered, skipping sync');
        return;
      }
      
      // CRITICAL: Only sync roadmap/goal data if user has premium subscription
      // This ensures free users' data stays local only
      // If forceSync is true and we have premium status from event, use that instead of checking
      const hasPremium =
        isPremiumFromEvent === true
          ? true
          : userSession.hasPremium;
      
      if (!hasPremium) {
        // If forceSync is true, retry after a delay (AsyncStorage might not be updated yet)
        if (forceSync && retryCount < 3) {
          console.log('[Ambition] ⚠️ Premium check failed but forceSync=true, retrying after delay (attempt', retryCount + 1, ')...');
          setTimeout(() => {
            syncAmbitionDataToDatabase(forceSync, isPremiumFromEvent, retryCount + 1);
          }, 1500); // Wait 1.5 seconds before retry
          return;
        }
        
        console.log('[Ambition] ⚠️ User does not have premium subscription, skipping cloud sync');
        console.log('[Ambition] Note: Roadmap/goal data is NOT saved to database for free users');
        console.log('[Ambition] Note: Subscription data is synced separately via unified-user-store');
        return;
      }
      
      syncInProgressRef.current = true;
      console.log('[Ambition] Syncing data to database (premium user)...');
      console.log('[Ambition] Store hydration status:', { isHydrated });
      
      // CRITICAL: If store isn't hydrated yet, read directly from AsyncStorage
      // This prevents syncing empty values and clearing the database
      let syncGoal: string | null = null;
      let syncTimeline: string | null = null;
      let syncTimeCommitment: string | null = null;
      let syncAnswers: string | null = null;
      let syncRoadmap: string | null = null;
      let syncCompletedTasks: string | null = null;
      let syncStreakData: string | null = null;
      let syncTaskTimers: string | null = null;
      
      if (!isHydrated) {
        console.log('[Ambition] ⚠️ Store not hydrated yet, reading from AsyncStorage...');
        try {
          const [
            storedGoal,
            storedTimeline,
            storedTimeCommitment,
            storedAnswers,
            storedRoadmap,
            storedCompletedTasks,
            storedStreakData,
            storedTaskTimers,
          ] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.GOAL),
            AsyncStorage.getItem(STORAGE_KEYS.TIMELINE),
            AsyncStorage.getItem(STORAGE_KEYS.TIME_COMMITMENT),
            AsyncStorage.getItem(STORAGE_KEYS.ANSWERS),
            AsyncStorage.getItem(STORAGE_KEYS.ROADMAP),
            AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS),
            AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA),
            AsyncStorage.getItem(STORAGE_KEYS.TASK_TIMERS),
          ]);
          
          syncGoal = storedGoal || null;
          syncTimeline = storedTimeline || null;
          syncTimeCommitment = storedTimeCommitment || null;
          syncAnswers = storedAnswers || null;
          syncRoadmap = storedRoadmap || null;
          syncCompletedTasks = storedCompletedTasks || null;
          syncStreakData = storedStreakData || null;
          syncTaskTimers = storedTaskTimers || null;
          
          console.log('[Ambition] Read from AsyncStorage:', {
            hasGoal: !!syncGoal,
            hasRoadmap: !!syncRoadmap,
            hasTimeline: !!syncTimeline,
            hasTimeCommitment: !!syncTimeCommitment,
          });
        } catch (storageError) {
          console.error('[Ambition] Failed to read from AsyncStorage, using state values:', storageError);
          // Fallback to state values if AsyncStorage read fails
          syncGoal = goal || null;
          syncTimeline = timeline || null;
          syncTimeCommitment = timeCommitment || null;
          syncAnswers = answers.length > 0 ? JSON.stringify(answers) : null;
          syncRoadmap = roadmap ? JSON.stringify(roadmap) : null;
          syncCompletedTasks = completedTasks.length > 0 ? JSON.stringify(completedTasks) : null;
          syncStreakData = streakData.streak > 0 ? JSON.stringify(streakData) : null;
          syncTaskTimers = taskTimers.length > 0 ? JSON.stringify(taskTimers) : null;
        }
      } else {
        // Store is hydrated, use state values
        syncGoal = goal || null;
        syncTimeline = timeline || null;
        syncTimeCommitment = timeCommitment || null;
        syncAnswers = answers.length > 0 ? JSON.stringify(answers) : null;
        syncRoadmap = roadmap ? JSON.stringify(roadmap) : null;
        syncCompletedTasks = completedTasks.length > 0 ? JSON.stringify(completedTasks) : null;
        syncStreakData = streakData.streak > 0 ? JSON.stringify(streakData) : null;
        syncTaskTimers = taskTimers.length > 0 ? JSON.stringify(taskTimers) : null;
      }
      
      // CRITICAL: Only sync roadmap/goal data if we actually have local data
      // Don't send null values if we don't have local data - this prevents clearing the database
      // We should only sync if:
      // 1. We have local data to sync (goal or roadmap exists), OR
      // 2. We're explicitly updating subscription data (which is handled separately)
      const hasLocalData = !!(syncGoal || syncRoadmap);
      
      if (!hasLocalData && !forceSync) {
        console.log('[Ambition] ⚠️ No local roadmap/goal data to sync, skipping data sync (subscription will still sync separately)');
        console.log('[Ambition] This prevents clearing existing database data when store is not hydrated');
        // Don't sync empty values - just return
        // Subscription data is synced separately via unified-user-store
        syncInProgressRef.current = false;
        return;
      }
      
      // Get subscription data from unified user store
      let subscriptionPlan: string | undefined;
      let subscriptionStatus: string | null | undefined;
      let subscriptionExpiresAt: string | null | undefined;
      let subscriptionPurchasedAt: string | null | undefined;
      
      try {
        const { STORAGE_KEYS } = await import('../constants');
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          subscriptionPlan = userData.subscriptionPlan;
          subscriptionStatus = userData.subscriptionStatus;
          subscriptionExpiresAt = userData.subscriptionExpiresAt ? new Date(userData.subscriptionExpiresAt).toISOString() : null;
          subscriptionPurchasedAt = userData.subscriptionPurchasedAt ? new Date(userData.subscriptionPurchasedAt).toISOString() : null;
        }
      } catch (subError) {
        console.warn('[Ambition] Failed to get subscription data for sync:', subError);
      }
      
      // Prepare sync payload - only include fields that have actual data
      // CRITICAL: Don't include fields with null/empty values to prevent clearing database
      const syncPayload: any = {
        email: userSession.email,
      };
      
      // Only include roadmap/goal fields if they have actual data
      if (syncGoal) syncPayload.goal = syncGoal;
      if (syncTimeline) syncPayload.timeline = syncTimeline;
      if (syncTimeCommitment) syncPayload.timeCommitment = syncTimeCommitment;
      if (syncAnswers) syncPayload.answers = syncAnswers;
      if (syncRoadmap) syncPayload.roadmap = syncRoadmap;
      if (syncCompletedTasks) syncPayload.completedTasks = syncCompletedTasks;
      if (syncStreakData) syncPayload.streakData = syncStreakData;
      if (syncTaskTimers) syncPayload.taskTimers = syncTaskTimers;
      
      // Always include subscription data (can be null/undefined)
      if (subscriptionPlan !== undefined) syncPayload.subscriptionPlan = subscriptionPlan;
      if (subscriptionStatus !== undefined) syncPayload.subscriptionStatus = subscriptionStatus;
      if (subscriptionExpiresAt !== undefined) syncPayload.subscriptionExpiresAt = subscriptionExpiresAt;
      if (subscriptionPurchasedAt !== undefined) syncPayload.subscriptionPurchasedAt = subscriptionPurchasedAt;
      
      console.log('[Ambition] Syncing data payload:', {
        email: syncPayload.email,
        hasGoal: !!syncPayload.goal,
        hasRoadmap: !!syncPayload.roadmap,
        goalLength: syncPayload.goal?.length || 0,
        roadmapLength: syncPayload.roadmap?.length || 0,
        completedTasksCount: syncPayload.completedTasks ? JSON.parse(syncPayload.completedTasks).length : 0,
        subscriptionPlan: syncPayload.subscriptionPlan,
        subscriptionStatus: syncPayload.subscriptionStatus,
      });
      
      // Use mutateAsync for proper async handling
      const result = await updateUserMutation.mutateAsync(syncPayload);
      
      lastSyncTimeRef.current = Date.now();
      
      console.log('[Ambition] ✅ Data synced to database successfully:', {
        success: result.success,
        userId: result.user?.id,
        email: result.user?.email,
        updatedAt: result.user?.updatedAt,
        lastSyncAt: result.user?.lastSyncAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[Ambition] ❌ Error syncing data to database:', {
        message: errorMessage,
        stack: errorStack,
        error: error,
        retryCount,
      });
      
      // Log more details about the error
      if (errorMessage.includes('Network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        console.error('[Ambition] Network error - backend may be unreachable');
        // Retry network errors after a delay (up to 3 retries)
        if (retryCount < 3 && forceSync) {
          console.log('[Ambition] Retrying sync after network error in 5 seconds...');
          setTimeout(() => {
            syncAmbitionDataToDatabase(forceSync, isPremiumFromEvent, retryCount + 1);
          }, 5000);
          return; // Don't clear syncInProgress yet
        }
      } else if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        console.error('[Ambition] JSON parsing error - backend may have returned invalid response');
      } else if (errorMessage.includes('User not found') || errorMessage.includes('not found')) {
        console.error('[Ambition] User not found in database - user may need to be created first');
      } else {
        console.error('[Ambition] Unknown sync error - check backend logs');
      }
      
      // Don't throw - sync failures shouldn't break the app
    } finally {
      syncInProgressRef.current = false;
    }
  }, [goal, timeline, timeCommitment, answers, roadmap, completedTasks, streakData, taskTimers, updateUserMutation, isHydrated]);
  
  // Debounced sync function - waits 2 seconds after last change before syncing
  const debouncedSync = useCallback((forceSync: boolean = false) => {
    // Clear existing debounce timer
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
    }
    
    // Set new debounce timer
    syncDebounceTimerRef.current = setTimeout(() => {
      syncAmbitionDataToDatabase(forceSync);
    }, 2000); // Wait 2 seconds after last change
  }, [syncAmbitionDataToDatabase]);

  // Load data from storage - extracted to reusable function
  const loadDataFromStorage = useCallback(async () => {
    try {
      console.log('[Ambition] Loading data from storage...');
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Storage load timeout')), 5000);
      });
      
      const storagePromise = Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.TIMELINE),
        AsyncStorage.getItem(STORAGE_KEYS.TIME_COMMITMENT),
        AsyncStorage.getItem(STORAGE_KEYS.ANSWERS),
        AsyncStorage.getItem(STORAGE_KEYS.ROADMAP),
        AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.TASK_TIMERS),
      ]);
      
      const [
        storedGoal,
        storedTimeline,
        storedTimeCommitment,
        storedAnswers,
        storedRoadmap,
        storedCompletedTasks,
        storedStreakData,
        storedTaskTimers,
      ] = await Promise.race([storagePromise, timeoutPromise]) as string[];

      if (storedGoal) {
        setGoalState(storedGoal);
        console.log('[Ambition] ✅ Goal loaded from storage:', storedGoal.substring(0, 50) + '...');
      } else {
        console.log('[Ambition] No goal found in storage');
      }
      if (storedTimeline) {
        setTimelineState(storedTimeline);
        console.log('[Ambition] ✅ Timeline loaded from storage:', storedTimeline);
      }
      if (storedTimeCommitment) {
        setTimeCommitmentState(storedTimeCommitment);
        console.log('[Ambition] ✅ Time commitment loaded from storage:', storedTimeCommitment);
      }
      if (storedAnswers) {
        try {
          const parsed = JSON.parse(storedAnswers);
          setAnswersState(parsed);
        } catch (error) {
          console.error('Failed to parse stored answers:', error);
          console.error('Stored answers value:', storedAnswers?.substring(0, 100));
          setAnswersState([]);
        }
      }
      if (storedRoadmap) {
        try {
          const parsed = JSON.parse(storedRoadmap);
          // Convert createdAt string back to Date object if it exists
          if (parsed.createdAt && typeof parsed.createdAt === 'string') {
            parsed.createdAt = new Date(parsed.createdAt);
          }
          // Validate that the roadmap has the expected structure
          if (parsed && typeof parsed === 'object' && parsed.phases && Array.isArray(parsed.phases)) {
            setRoadmapState(parsed);
            console.log('[Ambition] ✅ Roadmap loaded from storage');
          } else {
            console.warn('Invalid roadmap structure loaded from storage, setting to null');
            setRoadmapState(null);
          }
        } catch (error) {
          console.error('Failed to parse stored roadmap:', error);
          console.error('Stored roadmap value:', storedRoadmap?.substring(0, 100));
          setRoadmapState(null);
        }
      }
      if (storedCompletedTasks) {
        try {
          const parsed = JSON.parse(storedCompletedTasks);
          setCompletedTasksState(parsed);
        } catch (error) {
          console.error('Failed to parse stored completed tasks:', error);
          console.error('Stored completed tasks value:', storedCompletedTasks?.substring(0, 100));
          setCompletedTasksState([]);
        }
      }
      if (storedStreakData) {
        try {
          const parsed = JSON.parse(storedStreakData);
          setStreakDataState(parsed);
        } catch (error) {
          console.error('Failed to parse stored streak data:', error);
          console.error('Stored streak data value:', storedStreakData?.substring(0, 100));
          setStreakDataState({ lastCompletionDate: '', streak: 0 });
        }
      }
      if (storedTaskTimers) {
        try {
          const parsed = JSON.parse(storedTaskTimers);
          setTaskTimersState(parsed);
        } catch (error) {
          console.error('Failed to parse stored task timers:', error);
          console.error('Stored task timers value:', storedTaskTimers?.substring(0, 100));
          setTaskTimersState([]);
        }
      }
      
      console.log('[Ambition] ✅ Data loaded from storage');
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }, []);

  // Load data from storage on init (only once)
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    // Prevent re-hydration when app resumes from background
    if (hasLoadedRef.current) {
      console.log('[Ambition] Already loaded, skipping re-hydration');
      return;
    }

    let isMounted = true;
    
    const loadData = async () => {
      await loadDataFromStorage();
      if (isMounted) {
        hasLoadedRef.current = true;
        setIsHydrated(true);
      }
    };
    
    // Add a fallback timeout to ensure hydration completes
    const fallbackTimeout = setTimeout(() => {
      if (isMounted && !isHydrated) {
        console.warn('Hydration timeout, marking as hydrated');
        hasLoadedRef.current = true;
        setIsHydrated(true);
      }
    }, 3000);
    
    loadData();
    
    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
    };
  }, [isHydrated, loadDataFromStorage]);

  // Monitor AppState and sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      
      console.log('[Ambition] AppState changed:', { from: previousAppState, to: nextAppState });
      
      // When app comes to foreground, sync data if it's been more than 30 seconds since last sync
      if (nextAppState === 'active' && previousAppState !== 'active') {
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        const thirtySeconds = 30 * 1000;
        
        if (timeSinceLastSync > thirtySeconds) {
          console.log('[Ambition] App came to foreground, syncing data...');
          // Wait 2 seconds after app becomes active to ensure everything is ready
          setTimeout(() => {
            syncAmbitionDataToDatabase(true);
          }, 2000);
        } else {
          console.log('[Ambition] App came to foreground, but last sync was recent (', Math.round(timeSinceLastSync / 1000), 'seconds ago)');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [syncAmbitionDataToDatabase]);
  
  // Periodic sync every 2 minutes when app is active
  useEffect(() => {
    if (!isHydrated) return;
    
    // Clear any existing interval
    if (periodicSyncIntervalRef.current) {
      clearInterval(periodicSyncIntervalRef.current);
    }
    
    // Set up periodic sync (every 2 minutes)
    periodicSyncIntervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active' && isHydrated) {
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        const twoMinutes = 2 * 60 * 1000;
        
        // Only sync if it's been more than 2 minutes since last sync
        if (timeSinceLastSync > twoMinutes) {
          console.log('[Ambition] Periodic sync triggered (2 minutes elapsed)');
          syncAmbitionDataToDatabase(false);
        } else {
          console.log('[Ambition] Periodic sync skipped (last sync was', Math.round(timeSinceLastSync / 1000), 'seconds ago)');
        }
      }
    }, 2 * 60 * 1000); // Check every 2 minutes
    
    return () => {
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
      }
    };
  }, [isHydrated, syncAmbitionDataToDatabase]);

  // Listen for storage reload events (triggered after sign-in)
  useEffect(() => {
    const handleStorageReload = () => {
      console.log('[Ambition] Storage reload event received, reloading data...');
      loadDataFromStorage();
    };

    // Listen for clear all event (triggered on sign-out)
    const handleClearAll = async () => {
      console.log('[Ambition] Clear all event received, clearing in-memory state...');
      
      // Clear sync timers
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
        syncDebounceTimerRef.current = null;
      }
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
        periodicSyncIntervalRef.current = null;
      }
      
      // Cancel all notifications when clearing data on sign-out
      try {
        const { NotificationService } = await import('../lib/notifications');
        await NotificationService.cancelAllTaskTimerNotifications();
        console.log('[Ambition] ✅ Cancelled all task timer notifications on sign-out');
      } catch (error) {
        console.warn('[Ambition] Failed to cancel notifications on sign-out:', error);
      }
      
      // Clear all in-memory state immediately
      setGoalState('');
      setTimelineState('');
      setTimeCommitmentState('');
      setAnswersState([]);
      setRoadmapState(null);
      setCompletedTasksState([]);
      setStreakDataState({ lastCompletionDate: '', streak: 0 });
      setTaskTimersState([]);
      lastSyncTimeRef.current = 0;
      console.log('[Ambition] ✅ In-memory state cleared');
    };

    // Listen for React Native DeviceEventEmitter events
    const { DeviceEventEmitter } = require('react-native');
    const reloadSubscription = DeviceEventEmitter.addListener('ambition-storage-reload', handleStorageReload);
    const clearSubscription = DeviceEventEmitter.addListener('ambition-clear-all', handleClearAll);
    
    // Listen for premium upgrade trigger to sync data
    const syncTriggerHandler = (eventData?: { forceSync?: boolean; isPremium?: boolean }) => {
      console.log('[Ambition] Received premium upgrade trigger, syncing data...', eventData);
      // If forceSync is true, we'll retry even if premium check initially fails
      syncAmbitionDataToDatabase(eventData?.forceSync, eventData?.isPremium);
    };
    const syncSubscription = DeviceEventEmitter.addListener('ambition-sync-trigger', syncTriggerHandler);
    
    // Listen for realtime database updates
    const databaseUpdateHandler = async (updateData: {
      goal?: string | null;
      roadmap?: string | null;
      timeline?: string | null;
      timeCommitment?: string | null;
      answers?: string | null;
      completedTasks?: string | null;
      streakData?: string | null;
      taskTimers?: string | null;
    }) => {
      console.log('[Ambition] 🔔 Received database update from realtime sync:', {
        hasGoal: updateData.goal !== undefined,
        hasRoadmap: updateData.roadmap !== undefined,
        hasTimeline: updateData.timeline !== undefined,
        hasTimeCommitment: updateData.timeCommitment !== undefined,
        hasAnswers: updateData.answers !== undefined,
        hasCompletedTasks: updateData.completedTasks !== undefined,
        hasStreakData: updateData.streakData !== undefined,
        hasTaskTimers: updateData.taskTimers !== undefined,
      });

      try {
        // Update goal if provided
        if (updateData.goal !== undefined) {
          if (updateData.goal !== null && updateData.goal !== '') {
            setGoalState(updateData.goal);
            await AsyncStorage.setItem(STORAGE_KEYS.GOAL, updateData.goal);
            console.log('[Ambition] ✅ Goal updated from database:', updateData.goal.substring(0, 50) + '...');
          } else {
            // Clear goal if null or empty
            setGoalState('');
            await AsyncStorage.removeItem(STORAGE_KEYS.GOAL);
            console.log('[Ambition] ✅ Goal cleared from database');
          }
        }

        // Update timeline if provided
        if (updateData.timeline !== undefined) {
          if (updateData.timeline !== null && updateData.timeline !== '') {
            setTimelineState(updateData.timeline);
            await AsyncStorage.setItem(STORAGE_KEYS.TIMELINE, updateData.timeline);
            console.log('[Ambition] ✅ Timeline updated from database');
          } else {
            setTimelineState('');
            await AsyncStorage.removeItem(STORAGE_KEYS.TIMELINE);
          }
        }

        // Update time commitment if provided
        if (updateData.timeCommitment !== undefined) {
          if (updateData.timeCommitment !== null && updateData.timeCommitment !== '') {
            setTimeCommitmentState(updateData.timeCommitment);
            await AsyncStorage.setItem(STORAGE_KEYS.TIME_COMMITMENT, updateData.timeCommitment);
            console.log('[Ambition] ✅ Time commitment updated from database');
          } else {
            setTimeCommitmentState('');
            await AsyncStorage.removeItem(STORAGE_KEYS.TIME_COMMITMENT);
          }
        }

        // Update answers if provided
        if (updateData.answers !== undefined) {
          if (updateData.answers !== null && updateData.answers !== '') {
            try {
              const parsedAnswers = JSON.parse(updateData.answers);
              if (Array.isArray(parsedAnswers)) {
                setAnswersState(parsedAnswers);
                await AsyncStorage.setItem(STORAGE_KEYS.ANSWERS, updateData.answers);
                console.log('[Ambition] ✅ Answers updated from database');
              }
            } catch (e) {
              console.error('[Ambition] Failed to parse answers from database:', e);
            }
          } else {
            setAnswersState([]);
            await AsyncStorage.removeItem(STORAGE_KEYS.ANSWERS);
          }
        }

        // Update roadmap if provided
        if (updateData.roadmap !== undefined) {
          if (updateData.roadmap !== null && updateData.roadmap !== '') {
            try {
              const parsedRoadmap = JSON.parse(updateData.roadmap);
              setRoadmapState(parsedRoadmap);
              await AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, updateData.roadmap);
              console.log('[Ambition] ✅ Roadmap updated from database');
            } catch (e) {
              console.error('[Ambition] Failed to parse roadmap from database:', e);
            }
          } else {
            setRoadmapState(null);
            await AsyncStorage.removeItem(STORAGE_KEYS.ROADMAP);
          }
        }

        // Update completed tasks if provided
        if (updateData.completedTasks !== undefined) {
          if (updateData.completedTasks !== null && updateData.completedTasks !== '') {
            try {
              const parsedCompletedTasks = JSON.parse(updateData.completedTasks);
              if (Array.isArray(parsedCompletedTasks)) {
                setCompletedTasksState(parsedCompletedTasks);
                await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, updateData.completedTasks);
                console.log('[Ambition] ✅ Completed tasks updated from database');
              }
            } catch (e) {
              console.error('[Ambition] Failed to parse completed tasks from database:', e);
            }
          } else {
            setCompletedTasksState([]);
            await AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_TASKS);
          }
        }

        // Update streak data if provided
        if (updateData.streakData !== undefined) {
          if (updateData.streakData !== null && updateData.streakData !== '') {
            try {
              const parsedStreakData = JSON.parse(updateData.streakData);
              setStreakDataState(parsedStreakData);
              await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, updateData.streakData);
              console.log('[Ambition] ✅ Streak data updated from database');
            } catch (e) {
              console.error('[Ambition] Failed to parse streak data from database:', e);
            }
          } else {
            setStreakDataState({ lastCompletionDate: '', streak: 0 });
            await AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA);
          }
        }

        // Update task timers if provided
        if (updateData.taskTimers !== undefined) {
          if (updateData.taskTimers !== null && updateData.taskTimers !== '') {
            try {
              const parsedTaskTimers = JSON.parse(updateData.taskTimers);
              if (Array.isArray(parsedTaskTimers)) {
                setTaskTimersState(parsedTaskTimers);
                await AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, updateData.taskTimers);
                console.log('[Ambition] ✅ Task timers updated from database');
              }
            } catch (e) {
              console.error('[Ambition] Failed to parse task timers from database:', e);
            }
          } else {
            setTaskTimersState([]);
            await AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS);
          }
        }

        console.log('[Ambition] ✅ All database updates applied successfully');
      } catch (error) {
        console.error('[Ambition] ❌ Error applying database updates:', error);
      }
    };
    const databaseUpdateSubscription = DeviceEventEmitter.addListener('ambition-database-update', databaseUpdateHandler);
    
    return () => {
      reloadSubscription.remove();
      clearSubscription.remove();
      syncSubscription.remove();
      databaseUpdateSubscription.remove();
    };
  }, [loadDataFromStorage, syncAmbitionDataToDatabase]);

  // Monitor timer completion and send fallback notifications ONLY when:
  // 1. Timer has actually completed (elapsed time >= required duration)
  // 2. Scheduled notification failed (notificationId is null/undefined/not active)
  // 3. We haven't already sent a fallback notification for this timer instance
  // Note: Primary notifications are scheduled when timers start and work in background
  // This fallback is ONLY for cases where the scheduled notification failed
  useEffect(() => {
    if (!isHydrated || !roadmap) return;

    const checkTimerCompletion = () => {
      taskTimers.forEach(timer => {
        if (!timer.isActive || timer.isCompleted) return;

        const wasComplete = previousTimerStates.current.get(timer.taskId) || false;
        
        // Calculate elapsed time and required duration FIRST to verify completion
        const elapsed = Date.now() - timer.startTime;
        const requiredDuration = timer.duration * 60 * 1000; // Required duration in milliseconds
        
        // CRITICAL: Only consider timer complete if elapsed time is FULLY >= required duration
        // Use strict comparison with no tolerance to prevent premature notifications
        const isActuallyComplete = elapsed >= requiredDuration;
        
        // Only use isTaskTimerComplete if we've verified the elapsed time is correct
        const isNowComplete = isActuallyComplete && isTaskTimerComplete(timer.taskId);
        const notificationKey = `fallback-${timer.taskId}-${timer.startTime}`;
        
        // Only send fallback notification if:
        // 1. Timer just completed (transitioned from not complete to complete)
        // 2. We haven't sent a fallback notification for this timer instance
        // 3. Timer has ACTUALLY run for the FULL required duration (STRICT check, no tolerance)
        // 4. No notification was scheduled (notificationId is null/undefined) - fallback only
        if (!wasComplete && isNowComplete && 
            !notificationSentRef.current.has(notificationKey) &&
            elapsed >= requiredDuration) { // STRICT: Must be fully complete, no tolerance
          
          // Only send fallback if no notification was scheduled (scheduling failed)
          // If notificationId exists, we assume the scheduled notification will fire
          // The fallback is only for cases where scheduling failed from the start
          if (!timer.notificationId) {
            console.log(`[Notifications] Timer completed for task ${timer.taskId} - no notification was scheduled, sending fallback notification`);
            console.log(`[Notifications] Timer details: elapsed=${elapsed}ms, required=${requiredDuration}ms, duration=${timer.duration}min`);
            
            // Find the task title for the notification
            let taskTitle = 'Task';
            if (roadmap?.phases) {
              for (const phase of roadmap.phases) {
                for (const milestone of phase.milestones) {
                  const task = milestone.tasks.find(t => t.id === timer.taskId);
                  if (task) {
                    taskTitle = task.title || 'Task';
                    break;
                  }
                }
                if (taskTitle !== 'Task') break;
              }
            }

            // Send immediate notification as fallback (ONLY when timer has actually completed)
            NotificationService.sendImmediateNotification(taskTitle, timer.taskId);
            
            // Mark fallback notification as sent for this timer instance
            notificationSentRef.current.add(notificationKey);
            
            console.log(`[Notifications] ✅ Fallback notification sent for completed task: ${taskTitle}`);
          } else {
            console.log(`[Notifications] Timer completed for task ${timer.taskId} - scheduled notification (ID: ${timer.notificationId}) should fire`);
            console.log(`[Notifications] Timer details: elapsed=${elapsed}ms, required=${requiredDuration}ms, duration=${timer.duration}min`);
          }
        } else if (!wasComplete && isNowComplete && elapsed < requiredDuration) {
          // Log warning if timer is marked complete but hasn't actually run long enough
          console.warn(`[Notifications] ⚠️ Timer ${timer.taskId} marked complete but elapsed (${elapsed}ms) < required (${requiredDuration}ms). NOT sending notification.`);
        }

        // Update previous state
        previousTimerStates.current.set(timer.taskId, isNowComplete);
      });
    };

    // Check every 2 seconds (less frequent to reduce overhead)
    const interval = setInterval(checkTimerCompletion, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [taskTimers, isHydrated, roadmap]);



  const setGoal = async (newGoal: string) => {
    // Input validation and sanitization
    if (!newGoal || typeof newGoal !== 'string') {
      console.warn('Invalid goal provided');
      return;
    }
    const sanitized = newGoal.trim().slice(0, 500);
    if (!sanitized) {
      console.warn('Goal cannot be empty after sanitization');
      return;
    }
    setGoalState(sanitized);
    await AsyncStorage.setItem(STORAGE_KEYS.GOAL, sanitized);
    console.log('[Ambition] ✅ Goal saved to storage:', sanitized.substring(0, 50) + '...');
    // Sync to database (debounced)
    debouncedSync();
  };

  const setTimeline = async (newTimeline: string) => {
    // Input validation and sanitization
    if (!newTimeline || typeof newTimeline !== 'string') {
      console.warn('Invalid timeline provided');
      return;
    }
    const sanitized = newTimeline.trim().slice(0, 100);
    if (!sanitized) {
      console.warn('Timeline cannot be empty after sanitization');
      return;
    }
    setTimelineState(sanitized);
    await AsyncStorage.setItem(STORAGE_KEYS.TIMELINE, sanitized);
    // Sync to database (debounced)
    debouncedSync();
  };

  const setTimeCommitment = async (newTimeCommitment: string) => {
    // Input validation and sanitization
    if (!newTimeCommitment || typeof newTimeCommitment !== 'string') {
      console.warn('Invalid time commitment provided');
      return;
    }
    const sanitized = newTimeCommitment.trim().slice(0, 100);
    if (!sanitized) {
      console.warn('Time commitment cannot be empty after sanitization');
      return;
    }
    setTimeCommitmentState(sanitized);
    await AsyncStorage.setItem(STORAGE_KEYS.TIME_COMMITMENT, sanitized);
    // Sync to database (debounced)
    debouncedSync();
  };

  const addAnswer = async (answer: string) => {
    // Input validation and sanitization
    if (!answer || typeof answer !== 'string') {
      console.warn('Invalid answer provided');
      return;
    }
    const sanitized = answer.trim().slice(0, 1000);
    if (!sanitized) {
      console.warn('Answer cannot be empty after sanitization');
      return;
    }
    const newAnswers = [...answers, sanitized];
    setAnswersState(newAnswers);
    await AsyncStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(newAnswers));
    // Sync to database (debounced)
    debouncedSync();
  };

  const inferIndustry = (g: string, contextAnswers: string[]): string => {
    const text = [g, ...contextAnswers].join(' ').toLowerCase();
    const pairs: Array<{ key: string; industry: string; synonyms: string[] }> = [
      { key: 'qsr', industry: 'Quick-Service Restaurants (Fast Food)', synonyms: ['mcdonald', 'burger king', 'wendy', 'kfc', 'taco bell', 'chipotle', 'restaurant', 'shift', 'food service', 'barista', 'server'] },
      { key: 'retail', industry: 'Retail & Store Operations', synonyms: ['retail', 'store', 'cashier', 'target', 'walmart', 'merchandising', 'pos', 'inventory'] },
      { key: 'software', industry: 'Software Engineering', synonyms: ['software', 'developer', 'engineering', 'react', 'frontend', 'backend', 'api', 'sprint', 'jira', 'github'] },
      { key: 'sales', industry: 'Sales & SDR/AE', synonyms: ['sales', 'sdr', 'ae', 'quota', 'crm', 'salesforce', 'pipeline', 'demo', 'outreach'] },
      { key: 'marketing', industry: 'Marketing & Content', synonyms: ['marketing', 'seo', 'sem', 'content', 'copy', 'campaign', 'hubspot'] },
      { key: 'design', industry: 'Product Design & UX', synonyms: ['design', 'figma', 'ux', 'ui', 'prototype'] },
      { key: 'healthcare', industry: 'Healthcare & Nursing', synonyms: ['nurse', 'healthcare', 'clinic', 'patient', 'hospital', 'rn', 'cna'] },
      { key: 'education', industry: 'Education & Teaching', synonyms: ['teacher', 'education', 'classroom', 'curriculum', 'students'] },
      { key: 'finance', industry: 'Finance & Accounting', synonyms: ['finance', 'accounting', 'fp&a', 'bookkeeping', 'quickbooks', 'excel model'] },
      { key: 'operations', industry: 'Operations & Logistics', synonyms: ['operations', 'ops', 'logistics', 'warehouse', 'supply', 'shift report'] },
      { key: 'fitness', industry: 'Fitness & Coaching', synonyms: ['fitness', 'trainer', 'coaching', 'workout', 'nutrition'] },
    ];

    for (const p of pairs) {
      if (p.synonyms.some(s => text.includes(s))) return p.industry;
    }
    return 'General Professional Development';
  };

  const generateRoadmap = async () => {
    // Prevent multiple simultaneous roadmap generations
    if (isGeneratingRoadmapRef.current) {
      console.log('[Roadmap] Already generating roadmap, skipping duplicate call');
      return;
    }
    
    try {
      console.log('[Roadmap] Starting roadmap generation with AI...');
      isGeneratingRoadmapRef.current = true;
      
      // Validate required data before making API call
      if (!goal || !timeline || !timeCommitment) {
        throw new Error('Missing required data: goal, timeline, or timeCommitment');
      }
      
      // Input sanitization
      const sanitizedGoal = goal.trim().slice(0, 500);
      const sanitizedTimeline = timeline.trim();
      const sanitizedTimeCommitment = timeCommitment.trim();
      const sanitizedAnswers = answers.map(answer => answer.trim().slice(0, 1000));
      
      if (!sanitizedGoal || !sanitizedTimeline || !sanitizedTimeCommitment) {
        throw new Error('Invalid input data after sanitization');
      }
      
      const constraints = [
        '3-4 phases (short, mid, long-term)',
        '2-3 milestones per phase',
        '3-5 tasks per milestone',
        'Tasks must be concrete, actionable, and directly related to achieving the goal',
        'Each task should build on previous tasks and create tangible progress',
        'Tasks should be specific to the user\'s goal and context',
        'Each task includes an estimatedTime - use realistic, achievable durations: "10 min", "15 min", "20 min", "30 min", "45 min", or "1 h" maximum',
        'Most tasks should be 15-30 minutes - only use 45 min or 1 h for substantial learning or practice sessions',
        'Avoid overestimating time - tasks should feel achievable and not overwhelming',
        'Include a mix of learning, practicing, building, and demonstrating skills',
        'Tasks should be measurable with clear completion criteria',
        'Focus on real-world application and skill development',
        'IMPORTANT: Avoid repetitive task types across milestones - vary task types significantly',
        'Journaling and reflection tasks are valuable but should be varied - do NOT include the same type of journaling task in every milestone',
        'If including journaling tasks, vary their purpose and format (e.g., progress reflection, learning journal, goal review, challenge analysis)',
        'Prioritize action-oriented tasks: building, creating, practicing, implementing, researching, designing, coding, writing, analyzing, etc.',
        'Each milestone should have diverse task types - avoid repetitive patterns where the same task type appears in multiple milestones',
        'Focus on tasks that produce tangible outputs or measurable progress toward the goal',
      ].join('\n- ');

      const industry = inferIndustry(sanitizedGoal, sanitizedAnswers);

      const prompt = `Create a personalized, actionable roadmap to achieve this goal: "${sanitizedGoal}"

Timeline: ${sanitizedTimeline}
Daily time commitment: ${sanitizedTimeCommitment}
Industry context: ${industry}

User background and context:
${sanitizedAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n')}

Create a comprehensive roadmap that:
- Breaks down the goal into logical phases (foundation → skill building → execution → mastery)
- Each phase contains 2-3 milestones that represent significant progress points
- Each milestone contains 3-5 specific, actionable tasks
- Tasks should be directly related to achieving "${sanitizedGoal}"
- Consider the user's ${sanitizedTimeCommitment} daily commitment when sizing tasks
- Keep time estimates realistic and achievable - most tasks should be 15-30 minutes
- Only use 45 min or 1 h for substantial learning modules or practice sessions
- Build progressively from foundational skills to advanced application
- Include both learning and practical application tasks
- Make tasks specific enough that the user knows exactly what to do
- Ensure tasks build on each other logically
- Vary task types significantly across milestones - avoid repetitive patterns
- Focus on action-oriented tasks that produce tangible outputs (build, create, practice, implement, research, design, code, write, analyze)
- Journaling and reflection tasks are valuable - include them when appropriate, but vary their purpose and format across milestones
- Avoid including the same type of journaling/reflection task in every milestone - if using journaling, make each instance serve a different purpose
- Each milestone should feel distinct with diverse task types that avoid repetition

Requirements:
- ${constraints}

Output ONLY valid JSON in this exact format:
{
  "phases": [
    {
      "title": "string",
      "description": "string",
      "milestones": [
        {
          "title": "string",
          "description": "string",
          "tasks": [
            {
              "title": "string",
              "description": "string",
              "estimatedTime": "string"
            }
          ]
        }
      ]
    }
  ]
}`;

      // Add timeout and retry logic with rate limiting
      const req = await httpRequest<{ completion: string }>('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are an expert career and skill development coach. Create comprehensive, actionable roadmaps that break down ambitious goals into achievable steps. Focus on practical, real-world tasks that build skills progressively. Each task should be specific, measurable, and directly contribute to achieving the stated goal. IMPORTANT: Vary task types significantly across milestones - avoid repetitive patterns. Journaling and reflection tasks are valuable and can be included, but vary their purpose and format (e.g., progress reflection, learning journal, goal review) - do NOT include the same type of journaling task in every milestone. Prioritize action-oriented tasks that produce tangible outputs. Output valid JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
        timeoutMs: 45000,
        retry: { retries: 3, factor: 2, minTimeoutMs: 500, maxTimeoutMs: 5000 },
        parseJson: true,
      });

      if (!req.ok) {
        throw req.error ?? new Error('Failed request');
      }

      const data = req.data as { completion: string | object };
      let roadmapData;

      try {
        // Check if completion is already an object
        if (typeof data.completion === 'object' && data.completion !== null) {
          console.log('AI response is already an object, using directly');
          roadmapData = data.completion;
        } else {
          // Try to parse the AI response as JSON string
          let cleanedResponse: string = String(data.completion ?? '');

          // Normalize smart quotes and stray characters
          cleanedResponse = cleanedResponse
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            .replace(/\u0000/g, '')
            .trim();
          
          // Remove markdown code blocks
          cleanedResponse = cleanedResponse.replace(/```json\n?|```/g, '');
          
          // Try to extract JSON from the response if it's wrapped in text
          const start = cleanedResponse.indexOf('{');
          const end = cleanedResponse.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            cleanedResponse = cleanedResponse.slice(start, end + 1);
          }
          
          console.log('Attempting to parse AI response:', cleanedResponse.substring(0, 200) + '...');
          roadmapData = JSON.parse(cleanedResponse);
        }
        
        // Validate the structure
        if (!roadmapData.phases || !Array.isArray(roadmapData.phases)) {
          throw new Error('Invalid roadmap structure: missing phases array');
        }
        
        console.log('Successfully parsed AI response');
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.log('Raw AI response:', data.completion);
        // Fallback roadmap if AI response is malformed
        roadmapData = createFallbackRoadmap(goal);
      }

      // Add IDs to the roadmap structure
      const processedRoadmap: Roadmap = {
        id: `roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal: sanitizedGoal,
        timeline: sanitizedTimeline,
        timeCommitment: sanitizedTimeCommitment,
        phases: roadmapData.phases.map((phase: any, phaseIndex: number) => ({
          id: `phase-${phaseIndex}`,
          title: phase.title,
          description: phase.description,
          milestones: phase.milestones.map((milestone: any, milestoneIndex: number) => ({
            id: `milestone-${phaseIndex}-${milestoneIndex}`,
            title: milestone.title,
            description: milestone.description,
            tasks: milestone.tasks.map((task: any, taskIndex: number) => ({
              id: `task-${phaseIndex}-${milestoneIndex}-${taskIndex}`,
              title: task.title,
              description: task.description,
              estimatedTime: task.estimatedTime,
            })),
          })),
        })),
        createdAt: new Date(),
      };

      setRoadmapState(processedRoadmap);
      await AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, JSON.stringify(processedRoadmap));
      console.log('[Ambition] ✅ Roadmap saved to storage:', {
        phases: processedRoadmap.phases.length,
        roadmapId: processedRoadmap.id,
      });
      
      // Clear all existing timers when generating a new roadmap
      console.log('[Ambition] Clearing existing timers for new roadmap');
      setTaskTimersState([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS);
      
      console.log('Roadmap generated successfully');
      analytics.trackRoadmapGenerated(sanitizedGoal, sanitizedTimeline, sanitizedTimeCommitment);
      
      // Sync to database immediately (roadmap generation is important)
      await syncAmbitionDataToDatabase(true);
    } catch (error) {
      console.error('Error generating roadmap:', error);
      const msg = error instanceof AppError ? error.message : (error as Error)?.message ?? 'Unexpected error';
      showToast(`Generation failed: ${msg}`, 'error');
      // Use fallback roadmap on error - use original values as fallback
      const fallbackRoadmap = createFallbackRoadmap(goal);
      const processedRoadmap: Roadmap = {
        id: `roadmap_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal,
        timeline,
        timeCommitment,
        phases: fallbackRoadmap.phases.map((phase: any, phaseIndex: number) => ({
          id: `phase-${phaseIndex}`,
          title: phase.title,
          description: phase.description,
          milestones: phase.milestones.map((milestone: any, milestoneIndex: number) => ({
            id: `milestone-${phaseIndex}-${milestoneIndex}`,
            title: milestone.title,
            description: milestone.description,
            tasks: milestone.tasks.map((task: any, taskIndex: number) => ({
              id: `task-${phaseIndex}-${milestoneIndex}-${taskIndex}`,
              title: task.title,
              description: task.description,
              estimatedTime: task.estimatedTime,
            })),
          })),
        })),
        createdAt: new Date(),
      };

      setRoadmapState(processedRoadmap);
      await AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, JSON.stringify(processedRoadmap));
      
      // Clear all existing timers when generating a new roadmap (fallback case)
      console.log('[Ambition] Clearing existing timers for new roadmap (fallback)');
      setTaskTimersState([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS);
      
      // Sync to database immediately (roadmap generation is important)
      await syncAmbitionDataToDatabase(true);
    } finally {
      isGeneratingRoadmapRef.current = false;
    }
  };

  const createFallbackRoadmap = (g: string) => ({
    phases: [
      {
        title: 'Foundation Phase',
        description: 'Set up tracking and get quick wins to build momentum',
        milestones: [
          {
            title: 'Quick Setup',
            description: 'Create tracking infrastructure and get immediate clarity',
            tasks: [
              {
                title: 'Create progress tracking document',
                description: `Create a Google Doc titled "${g || 'Goal'} - Progress Tracker" with sections for weekly wins, challenges, and next steps`,
                estimatedTime: '8 min',
              },
              {
                title: 'Send alignment message to manager',
                description: 'Send a Slack/email to your manager: "Hi [Name], I\'m working on [goal]. Can we schedule 20 min this week to align on success criteria?"',
                estimatedTime: '5 min',
              },
              {
                title: 'Define 3 success indicators',
                description: 'Write 3 specific evidence points that will prove progress (e.g., course certificate, shipped project, positive feedback)',
                estimatedTime: '10 min',
              },
            ],
          },
          {
            title: 'Resources Setup',
            description: 'Assemble concrete tools and templates you will use',
            tasks: [
              {
                title: 'Create a single tracking doc',
                description: `Open a Google Doc named "Ambitionly Roadmap — ${g || 'Goal'}" with sections: Phases, Milestones, Tasks, Evidence`,
                estimatedTime: '12 min',
              },
              {
                title: 'Pick one primary course/resource',
                description: 'Search your company LMS or Coursera and paste 1 course link into the doc; add module list and target dates',
                estimatedTime: '15 min',
              },
              {
                title: 'Identify a shadow/mentor opportunity',
                description: 'DM one senior colleague to request a 2‑hour shadow session; propose two time windows',
                estimatedTime: '7 min',
              },
            ],
          },
        ],
      },
      {
        title: 'Skill and Exposure Phase',
        description: 'Build capability through consistent daily practice and visible artifacts',
        milestones: [
          {
            title: 'Structured Learning',
            description: 'Complete a concrete course/module and capture takeaways',
            tasks: [
              {
                title: 'Complete course Module 1–2',
                description: 'Finish two modules of your selected course and summarize 5 bullet takeaways in the tracking doc',
                estimatedTime: '90 min',
              },
              {
                title: 'Apply one tactic on the job',
                description: 'Pick one concept from the course and implement it in a real scenario; capture before/after notes',
                estimatedTime: '45 min',
              },
              {
                title: 'Share a learning recap',
                description: 'Post a short update in team chat with 3 insights and 1 question; link the doc',
                estimatedTime: '20 min',
              },
            ],
          },
          {
            title: 'Shadow and Feedback',
            description: 'Observe an expert and collect structured notes',
            tasks: [
              {
                title: 'Shadow a senior for one shift/session',
                description: 'Observe a full 2–3 hour block; log 5 process observations and 2 scripts they use',
                estimatedTime: '3 h',
              },
              {
                title: 'Ask 3 targeted questions',
                description: 'After shadowing, ask about their decision criteria, trade-offs, and top mistake to avoid; document answers',
                estimatedTime: '20 min',
              },
              {
                title: 'Draft an improved template/process',
                description: 'Create or refine one template/checklist used in your role and share for feedback',
                estimatedTime: '60 min',
              },
            ],
          },
        ],
      },
      {
        title: 'Execution Phase',
        description: 'Ship measurable outputs through sustained daily effort',
        milestones: [
          {
            title: 'Own a recurring responsibility',
            description: 'Take ownership of deliverables through consistent daily contributions',
            tasks: [
              {
                title: 'Run this week\'s deliverable solo',
                description: 'Own the full cycle (prep to execution to report); collect feedback from your lead',
                estimatedTime: '2 h',
              },
              {
                title: 'Publish a one-page summary',
                description: 'Share outcomes and metrics in a one-pager to stakeholders; ask for one improvement suggestion',
                estimatedTime: '45 min',
              },
              {
                title: 'Schedule a calibration check-in',
                description: 'Book a 20‑min review with your manager to assess readiness against criteria; record next steps',
                estimatedTime: '20 min',
              },
            ],
          },
        ],
      },
    ],
  });

  // Helper function to parse time string to minutes
  const parseTimeToMinutes = (timeStr: string): number => {
    console.log(`[Timer] Parsing time string: "${timeStr}" (length: ${timeStr.length})`);
    
    // Handle empty or invalid input
    if (!timeStr || typeof timeStr !== 'string') {
      console.warn(`[Timer] Invalid time string: ${timeStr}`);
      return 20; // Default to 20 minutes instead of 30
    }
    
    // Handle different time formats
    const lowerTime = timeStr.toLowerCase().trim();
    let estimatedMinutes: number;
    
    console.log(`[Timer] Processed time string: "${lowerTime}"`);
    
    if (lowerTime.includes('h')) {
      // Handle hours (e.g., "1.5 h", "2 h")
      const hourMatch = lowerTime.match(/([0-9.]+)\s*h/);
      if (hourMatch) {
        const hours = parseFloat(hourMatch[1]);
        estimatedMinutes = Math.round(hours * 60);
        console.log(`[Timer] Parsed hours: ${hours} = ${estimatedMinutes} minutes`);
      } else {
        console.warn(`[Timer] Could not parse hours from: ${lowerTime}`);
        estimatedMinutes = 20; // Default to 20 minutes
      }
    } else if (lowerTime.includes('min')) {
      // Handle minutes (e.g., "45 min", "30 min")
      const minMatch = lowerTime.match(/([0-9]+)\s*min/);
      if (minMatch) {
        estimatedMinutes = parseInt(minMatch[1]);
        console.log(`[Timer] Parsed minutes: ${estimatedMinutes}`);
      } else {
        console.warn(`[Timer] Could not parse minutes from: ${lowerTime}`);
        estimatedMinutes = 20; // Default to 20 minutes
      }
    } else {
      // Try to extract any number and assume it's minutes
      const numberMatch = lowerTime.match(/([0-9]+)/);
      if (numberMatch) {
        estimatedMinutes = parseInt(numberMatch[1]);
        console.log(`[Timer] Extracted number: ${estimatedMinutes} (assuming minutes)`);
      } else {
        console.warn(`[Timer] No number found in: ${lowerTime}`);
        estimatedMinutes = 20; // Default to 20 minutes
      }
    }
    
    // Validate the result
    if (isNaN(estimatedMinutes) || estimatedMinutes <= 0) {
      console.warn(`[Timer] Invalid parsed result: ${estimatedMinutes}, using default`);
      estimatedMinutes = 20;
    }
    
    console.log(`[Timer] Final parsed result: "${timeStr}" -> ${estimatedMinutes} minutes`);
    return estimatedMinutes;
  };

  const startTaskTimer = async (taskId: string, estimatedTime: string) => {
    console.log(`[Timer] Starting timer for task ${taskId} with estimated time: ${estimatedTime}`);
    console.log(`[Timer] Current active timers:`, taskTimers.filter(t => t.isActive).map(t => t.taskId));
    
    // Check if this task already has an active timer
    const activeTimer = taskTimers.find(timer => timer.taskId === taskId && timer.isActive);
    if (activeTimer) {
      console.log(`[Timer] Task ${taskId} already has an active timer, not starting a new one`);
      return;
    }
    
    // Create new timer without affecting existing ones
    const duration = parseTimeToMinutes(estimatedTime);
    
    // Find the task title for the notification
    let taskTitle = 'Task';
    if (roadmap?.phases) {
      for (const phase of roadmap.phases) {
        if (!phase?.milestones) continue;
        for (const milestone of phase.milestones) {
          if (!milestone?.tasks) continue;
          const task = milestone.tasks.find(t => t.id === taskId);
          if (task) {
            taskTitle = task.title || 'Task';
            break;
          }
        }
        if (taskTitle !== 'Task') break;
      }
    }

    // Cancel any existing notifications for this task before scheduling a new one
    // This prevents duplicate notifications if the timer is restarted
    // Check for any timer (active or inactive) to cancel its notification
    const existingTimerForNotification = taskTimers.find(t => t.taskId === taskId);
    if (existingTimerForNotification?.notificationId) {
      try {
        await NotificationService.cancelNotification(existingTimerForNotification.notificationId);
        console.log(`[Timer] Cancelled existing notification for task ${taskId} before scheduling new one`);
      } catch (error) {
        console.warn(`[Timer] Failed to cancel existing notification:`, error);
      }
    }
    
    // Schedule notification for when timer completes (in seconds)
    const durationInSeconds = duration * 60;
    
    // Calculate start time first (before creating timer object)
    const startTime = Date.now();
    
    // Validate duration before scheduling - must be at least 5 seconds
    let notificationId: string | null = null;
    if (durationInSeconds >= 5 && !isNaN(durationInSeconds) && isFinite(durationInSeconds)) {
      try {
      console.log(`[Timer] Scheduling notification for ${durationInSeconds} seconds (${duration} minutes)`);
        console.log(`[Timer] Timer start time: ${startTime}, expected completion: ${startTime + (durationInSeconds * 1000)}`);
      notificationId = await NotificationService.scheduleTaskCompleteNotification(taskTitle, durationInSeconds, taskId);
      if (notificationId) {
        console.log(`[Timer] ✅ Notification scheduled successfully with ID: ${notificationId}`);
          console.log(`[Timer] Notification should fire in ${durationInSeconds} seconds (${duration} minutes)`);
      } else {
        console.warn(`[Timer] ⚠️ Failed to schedule notification - fallback will be used when timer completes`);
        }
      } catch (notificationError) {
        console.error(`[Timer] Error scheduling notification:`, notificationError);
        console.warn(`[Timer] ⚠️ Continuing without notification - timer will still start`);
        // Continue without notification - timer should still work
      }
    } else {
      console.error(`[Timer] Invalid duration: ${durationInSeconds} seconds (from ${duration} minutes). Cannot schedule notification. Minimum is 5 seconds.`);
    }

    const newTimer: TaskTimer = {
      taskId,
      startTime,
      duration,
      isActive: true,
      isCompleted: false,
      notificationId: notificationId || null,
    };
    
    console.log(`[Timer] Created new timer:`, newTimer);
    console.log(`[Timer] Scheduled notification for ${duration} minutes (${durationInSeconds} seconds)`);

    // Add new timer while preserving all existing timers
    const updatedTimers = [...taskTimers.filter(t => t.taskId !== taskId), newTimer];
    setTaskTimersState(updatedTimers);
    
    // Save to storage (timer is already in memory, so continue even if storage fails)
    try {
    await AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, JSON.stringify(updatedTimers));
      console.log(`[Timer] Timer saved to storage successfully`);
    } catch (storageError) {
      console.error(`[Timer] Error saving timer to storage:`, storageError);
      // Timer is already in memory state, so it will still work
      // Log warning but don't throw - timer functionality is not affected
      console.warn(`[Timer] ⚠️ Timer started but may not persist after app restart`);
    }
    
    console.log(`[Timer] Timer started successfully for task ${taskId}`);
    console.log(`[Timer] All timers after start:`, updatedTimers.filter(t => t.isActive).map(t => t.taskId));
    analytics.track('task_started', { task_id: taskId, duration_minutes: duration });
    
    // Sync to database (debounced, don't fail timer start if sync fails)
    try {
      debouncedSync();
    } catch (syncError) {
      console.error(`[Timer] Error scheduling sync:`, syncError);
      console.warn(`[Timer] ⚠️ Timer started successfully but sync scheduling failed - timer will continue to work locally`);
      // Don't throw - timer is already saved locally and working
    }
  };

  const stopTaskTimer = async (taskId: string) => {
    console.log(`[Timer] Stopping timer for task ${taskId}`);
    
    // Find the timer to cancel its notification
    const timerToStop = taskTimers.find(timer => timer.taskId === taskId && timer.isActive);
    if (timerToStop?.notificationId) {
      console.log(`[Timer] Cancelling notification ${timerToStop.notificationId} for task ${taskId}`);
      await NotificationService.cancelNotification(timerToStop.notificationId);
    }
    
    const updatedTimers = taskTimers.map(timer => {
      if (timer.taskId === taskId && timer.isActive) {
        console.log(`[Timer] Stopping timer for task ${timer.taskId}`);
        return { ...timer, isActive: false, notificationId: null };
      }
      return timer;
    });
    
    setTaskTimersState(updatedTimers);
    await AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, JSON.stringify(updatedTimers));
    
    console.log(`[Timer] Timer stopped successfully for task ${taskId}`);
    
    // Sync to database (debounced)
    debouncedSync();
  };

  const getTaskTimer = (taskId: string): TaskTimer | null => {
    return taskTimers.find(t => t.taskId === taskId) || null;
  };

  const getAllActiveTimers = (): TaskTimer[] => {
    return taskTimers.filter(t => t.isActive);
  };

  const isTaskTimerComplete = (taskId: string): boolean => {
    const timer = getTaskTimer(taskId);
    if (!timer || !timer.isActive) return false;
    
    // Validate timer data
    if (!timer.startTime || !timer.duration || timer.duration <= 0) {
      console.warn(`[Timer] Invalid timer data for task ${taskId}:`, timer);
      return false;
    }
    
    const elapsed = Date.now() - timer.startTime;
    const requiredTime = timer.duration * 60 * 1000; // convert to milliseconds
    
    // Validate calculations
    if (isNaN(elapsed) || isNaN(requiredTime) || !isFinite(elapsed) || !isFinite(requiredTime)) {
      console.warn(`[Timer] Invalid timer calculations for task ${taskId}: elapsed=${elapsed}, required=${requiredTime}`);
      return false;
    }
    
    // Only return true if elapsed time is FULLY >= required time (strict check)
    const isComplete = elapsed >= requiredTime;
    
    if (isComplete) {
      console.log(`[Timer] Timer ${taskId} is complete: elapsed=${elapsed}ms, required=${requiredTime}ms, duration=${timer.duration}min`);
    }
    
    return isComplete;
  };

  const getTaskTimerProgress = (taskId: string): { elapsed: number; total: number; percentage: number } => {
    const timer = getTaskTimer(taskId);
    if (!timer || !timer.isActive) {
      return { elapsed: 0, total: 0, percentage: 0 };
    }
    
    const elapsed = Math.max(0, Date.now() - timer.startTime);
    const total = timer.duration * 60 * 1000; // convert to milliseconds
    const percentage = Math.min(100, (elapsed / total) * 100);
    
    console.log(`[Timer Progress] TaskId: ${taskId}, Duration: ${timer.duration}min, Elapsed: ${elapsed}ms, Total: ${total}ms, Percentage: ${percentage}%`);
    
    return { elapsed, total, percentage };
  };

  const toggleTask = async (taskId: string) => {
    // Check if timer is required and completed
    const timer = getTaskTimer(taskId);
    const isTimerRequired = timer && timer.isActive;
    const isTimerCompleted = isTaskTimerComplete(taskId);
    
    // If timer is active but not completed, don't allow toggle
    if (isTimerRequired && !isTimerCompleted) {
      return false; // Return false to indicate toggle was not allowed
    }

    const newCompletedTasks = completedTasks.includes(taskId)
      ? completedTasks.filter(id => id !== taskId)
      : [...completedTasks, taskId];
    
    setCompletedTasksState(newCompletedTasks);
    await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, JSON.stringify(newCompletedTasks));

    // Mark timer as completed if it exists
    if (timer && !completedTasks.includes(taskId)) {
      // Cancel the scheduled notification since task is being manually completed
      if (timer.notificationId) {
        console.log(`[Timer] Cancelling notification ${timer.notificationId} for manually completed task ${taskId}`);
        await NotificationService.cancelNotification(timer.notificationId);
      }
      
      const updatedTimers = taskTimers.map(t => 
        t.taskId === taskId ? { ...t, isCompleted: true, isActive: false, notificationId: null } : t
      );
      setTaskTimersState(updatedTimers);
      await AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, JSON.stringify(updatedTimers));
    }

    // Update streak if task was completed (not uncompleted)
    if (!completedTasks.includes(taskId)) {
      await updateStreak();
      analytics.trackTaskCompleted(taskId, timer ? Date.now() - timer.startTime : 0);
    }
    
    // Sync to database immediately (task completion is important)
    await syncAmbitionDataToDatabase(true);
    
    return true; // Return true to indicate toggle was successful
  };

  const updateStreak = async () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    let newStreak = 1;
    
    if (streakData.lastCompletionDate === yesterday) {
      // Continuing streak
      newStreak = streakData.streak + 1;
    } else if (streakData.lastCompletionDate === today) {
      // Already completed today, keep current streak
      newStreak = streakData.streak;
    }
    // If last completion was more than 1 day ago, streak resets to 1

    const newStreakData = {
      lastCompletionDate: today,
      streak: newStreak,
    };

    setStreakDataState(newStreakData);
    await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(newStreakData));
    
    // Track streak achievement
    if (newStreak > 1) {
      analytics.trackStreakAchieved(newStreak);
    }
    
    // Sync to database (debounced)
    debouncedSync();
  };

  const getProgress = () => {
    if (!roadmap) return 0;
    
    const totalTasks = roadmap.phases.reduce((total, phase) => {
      return total + phase.milestones.reduce((milestoneTotal, milestone) => {
        return milestoneTotal + milestone.tasks.length;
      }, 0);
    }, 0);

    if (totalTasks === 0) return 0;
    
    return (completedTasks.length / totalTasks) * 100;
  };

  const getStreak = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    // If last completion was today or yesterday, return current streak
    if (streakData.lastCompletionDate === today || streakData.lastCompletionDate === yesterday) {
      return streakData.streak;
    }
    
    // Otherwise, streak is broken
    return 0;
  };

  const getCompletedTasksThisWeek = () => {
    // This is a simplified version - in a real app, you'd track completion dates
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    // For now, return a portion of completed tasks as "this week"
    return Math.min(completedTasks.length, 7);
  };

  // Helper functions for progressive unlocking
  const isTaskUnlocked = (phaseIndex: number, milestoneIndex: number, taskIndex: number): boolean => {
    if (!roadmap) return false;
    
    // First task of first milestone of first phase is always unlocked
    if (phaseIndex === 0 && milestoneIndex === 0 && taskIndex === 0) {
      return true;
    }
    
    // Check if previous task in same milestone is completed
    if (taskIndex > 0) {
      const previousTaskId = `task-${phaseIndex}-${milestoneIndex}-${taskIndex - 1}`;
      return completedTasks.includes(previousTaskId);
    }
    
    // Check if previous milestone in same phase is completed
    if (milestoneIndex > 0) {
      const previousMilestone = roadmap.phases[phaseIndex].milestones[milestoneIndex - 1];
      const allPreviousMilestoneTasks = previousMilestone.tasks.map((_, tIndex) => 
        `task-${phaseIndex}-${milestoneIndex - 1}-${tIndex}`
      );
      return allPreviousMilestoneTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    // Check if previous phase is completed
    if (phaseIndex > 0) {
      const previousPhase = roadmap.phases[phaseIndex - 1];
      const allPreviousPhaseTasks: string[] = [];
      
      previousPhase.milestones.forEach((milestone, mIndex) => {
        milestone.tasks.forEach((_, tIndex) => {
          allPreviousPhaseTasks.push(`task-${phaseIndex - 1}-${mIndex}-${tIndex}`);
        });
      });
      
      return allPreviousPhaseTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    return false;
  };
  
  const isMilestoneUnlocked = (phaseIndex: number, milestoneIndex: number): boolean => {
    if (!roadmap) return false;
    
    // First milestone of first phase is always unlocked
    if (phaseIndex === 0 && milestoneIndex === 0) {
      return true;
    }
    
    // Check if previous milestone in same phase is completed
    if (milestoneIndex > 0) {
      const previousMilestone = roadmap.phases[phaseIndex].milestones[milestoneIndex - 1];
      const allPreviousMilestoneTasks = previousMilestone.tasks.map((_, tIndex) => 
        `task-${phaseIndex}-${milestoneIndex - 1}-${tIndex}`
      );
      return allPreviousMilestoneTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    // Check if previous phase is completed
    if (phaseIndex > 0) {
      const previousPhase = roadmap.phases[phaseIndex - 1];
      const allPreviousPhaseTasks: string[] = [];
      
      previousPhase.milestones.forEach((milestone, mIndex) => {
        milestone.tasks.forEach((_, tIndex) => {
          allPreviousPhaseTasks.push(`task-${phaseIndex - 1}-${mIndex}-${tIndex}`);
        });
      });
      
      return allPreviousPhaseTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    return false;
  };
  
  const isPhaseUnlocked = (phaseIndex: number): boolean => {
    if (!roadmap) return false;
    
    // First phase is always unlocked
    if (phaseIndex === 0) {
      return true;
    }
    
    // Check if previous phase is completed
    const previousPhase = roadmap.phases[phaseIndex - 1];
    const allPreviousPhaseTasks: string[] = [];
    
    previousPhase.milestones.forEach((milestone, mIndex) => {
      milestone.tasks.forEach((_, tIndex) => {
        allPreviousPhaseTasks.push(`task-${phaseIndex - 1}-${mIndex}-${tIndex}`);
      });
    });
    
    return allPreviousPhaseTasks.every(taskId => completedTasks.includes(taskId));
  };

  const resetProgress = async () => {
    try {
      console.log('[Ambition] resetProgress: clearing completed tasks, timers, and streak only');
      
      // Cancel all task timer notifications before clearing timers
      const { NotificationService } = await import('../lib/notifications');
      await NotificationService.cancelAllTaskTimerNotifications();
      console.log('[Ambition] ✅ Cancelled all task timer notifications');
      
      // Also cancel individual timer notifications if they exist
      for (const timer of taskTimers) {
        if (timer.notificationId) {
          try {
            await NotificationService.cancelNotification(timer.notificationId);
          } catch (error) {
            console.warn(`[Ambition] Failed to cancel notification for timer ${timer.taskId}:`, error);
          }
        }
      }
      
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS),
      ]);
      setCompletedTasksState([]);
      setStreakDataState({ lastCompletionDate: '', streak: 0 });
      setTaskTimersState([]);
      
      // Sync to database immediately after reset
      await syncAmbitionDataToDatabase(true);
    } catch (error) {
      console.error('Error resetting progress:', error);
    }
    analytics.trackFeatureUsed('reset_progress');
  };

  const clearAllData = async () => {
    try {
      console.log('[Ambition] clearAllData: removing all persisted keys');
      
      // Cancel ALL task timer notifications before clearing data
      // This prevents notifications from old roadmaps from firing
      const { NotificationService } = await import('../lib/notifications');
      await NotificationService.cancelAllTaskTimerNotifications();
      console.log('[Ambition] ✅ Cancelled all task timer notifications');
      
      // Also cancel individual timer notifications if they exist
      for (const timer of taskTimers) {
        if (timer.notificationId) {
          try {
            await NotificationService.cancelNotification(timer.notificationId);
          } catch (error) {
            console.warn(`[Ambition] Failed to cancel notification for timer ${timer.taskId}:`, error);
          }
        }
      }
      
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.GOAL),
        AsyncStorage.removeItem(STORAGE_KEYS.TIMELINE),
        AsyncStorage.removeItem(STORAGE_KEYS.TIME_COMMITMENT),
        AsyncStorage.removeItem(STORAGE_KEYS.ANSWERS),
        AsyncStorage.removeItem(STORAGE_KEYS.ROADMAP),
        AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS),
      ]);

      setGoalState('');
      setTimelineState('');
      setTimeCommitmentState('');
      setAnswersState([]);
      setRoadmapState(null);
      setCompletedTasksState([]);
      setStreakDataState({ lastCompletionDate: '', streak: 0 });
      setTaskTimersState([]);
      
      // Sync to database immediately after clearing (will sync empty/null values)
      await syncAmbitionDataToDatabase(true);
    } catch (error) {
      console.error('Error clearing data:', error);
    }
    analytics.trackFeatureUsed('clear_data');
  };

  return {
    isHydrated,
    goal,
    timeline,
    timeCommitment,
    answers,
    roadmap,
    completedTasks,
    taskTimers,
    setGoal,
    setTimeline,
    setTimeCommitment,
    addAnswer,
    generateRoadmap,
    toggleTask,
    startTaskTimer,
    stopTaskTimer,
    getTaskTimer,
    getAllActiveTimers,
    isTaskTimerComplete,
    getTaskTimerProgress,
    getProgress,
    getStreak,
    getCompletedTasksThisWeek,
    resetProgress,
    clearAllData,
    isTaskUnlocked,
    isMilestoneUnlocked,
    isPhaseUnlocked,
    reloadFromStorage: loadDataFromStorage,
    syncToDatabase: () => syncAmbitionDataToDatabase(true),
  };
});

