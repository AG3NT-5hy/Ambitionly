/**
 * User Data Migration
 * Handles migrating guest user data when they sign up
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GuestData {
  // Ambition data
  goal: string | null;
  timeline: string | null;
  timeCommitment: string | null;
  answers: any;
  roadmap: any;
  completedTasks: string[];
  streakData: any;
  taskTimers: any;
  
  // Subscription data
  subscriptionPlan: string;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: Date | null;
  subscriptionPurchasedAt: Date | null;
  
  // Profile data
  profilePicture: string | null;
}

const GUEST_DATA_KEYS = {
  GOAL: 'ambitionly_goal',
  TIMELINE: 'ambitionly_timeline',
  TIME_COMMITMENT: 'ambitionly_time_commitment',
  ANSWERS: 'ambitionly_answers',
  ROADMAP: 'ambitionly_roadmap',
  COMPLETED_TASKS: 'ambitionly_completed_tasks',
  STREAK_DATA: 'ambitionly_streak_data',
  TASK_TIMERS: 'ambitionly_task_timers',
  SUBSCRIPTION: 'ambitionly_subscription_state',
  USER: 'ambitionly_user',
};

/**
 * Collect all guest user data from local storage
 */
export async function collectGuestData(): Promise<GuestData> {
  console.log('[Migration] Collecting guest data...');
  
  try {
    const [
      goal,
      timeline,
      timeCommitment,
      answersStr,
      roadmapStr,
      completedTasksStr,
      streakDataStr,
      taskTimersStr,
      subscriptionStr,
      userStr,
    ] = await Promise.all([
      AsyncStorage.getItem(GUEST_DATA_KEYS.GOAL),
      AsyncStorage.getItem(GUEST_DATA_KEYS.TIMELINE),
      AsyncStorage.getItem(GUEST_DATA_KEYS.TIME_COMMITMENT),
      AsyncStorage.getItem(GUEST_DATA_KEYS.ANSWERS),
      AsyncStorage.getItem(GUEST_DATA_KEYS.ROADMAP),
      AsyncStorage.getItem(GUEST_DATA_KEYS.COMPLETED_TASKS),
      AsyncStorage.getItem(GUEST_DATA_KEYS.STREAK_DATA),
      AsyncStorage.getItem(GUEST_DATA_KEYS.TASK_TIMERS),
      AsyncStorage.getItem(GUEST_DATA_KEYS.SUBSCRIPTION),
      AsyncStorage.getItem(GUEST_DATA_KEYS.USER),
    ]);

    // Parse JSON data
    const answers = answersStr ? JSON.parse(answersStr) : null;
    const roadmap = roadmapStr ? JSON.parse(roadmapStr) : null;
    const completedTasks = completedTasksStr ? JSON.parse(completedTasksStr) : [];
    const streakData = streakDataStr ? JSON.parse(streakDataStr) : null;
    const taskTimers = taskTimersStr ? JSON.parse(taskTimersStr) : null;
    const subscription = subscriptionStr ? JSON.parse(subscriptionStr) : null;
    const user = userStr ? JSON.parse(userStr) : null;

    const guestData: GuestData = {
      goal,
      timeline,
      timeCommitment,
      answers,
      roadmap,
      completedTasks,
      streakData,
      taskTimers,
      subscriptionPlan: subscription?.plan || 'free',
      subscriptionStatus: subscription?.isActive ? 'active' : null,
      subscriptionExpiresAt: subscription?.expiresAt ? new Date(subscription.expiresAt) : null,
      subscriptionPurchasedAt: subscription?.purchasedAt ? new Date(subscription.purchasedAt) : null,
      profilePicture: user?.profilePicture || null,
    };

    console.log('[Migration] Guest data collected:', {
      hasGoal: !!guestData.goal,
      hasRoadmap: !!guestData.roadmap,
      completedTasksCount: guestData.completedTasks?.length || 0,
      subscriptionPlan: guestData.subscriptionPlan,
    });

    return guestData;
  } catch (error) {
    console.error('[Migration] Error collecting guest data:', error);
    // Return empty data if error
    return {
      goal: null,
      timeline: null,
      timeCommitment: null,
      answers: null,
      roadmap: null,
      completedTasks: [],
      streakData: null,
      taskTimers: null,
      subscriptionPlan: 'free',
      subscriptionStatus: null,
      subscriptionExpiresAt: null,
      subscriptionPurchasedAt: null,
      profilePicture: null,
    };
  }
}

/**
 * Clear guest data after successful migration
 * Keep only the unified user data
 */
export async function clearGuestData(keepSubscription: boolean = false): Promise<void> {
  console.log('[Migration] Clearing guest data...');
  
  try {
    const keysToRemove = [
      GUEST_DATA_KEYS.GOAL,
      GUEST_DATA_KEYS.TIMELINE,
      GUEST_DATA_KEYS.TIME_COMMITMENT,
      GUEST_DATA_KEYS.ANSWERS,
      GUEST_DATA_KEYS.ROADMAP,
      GUEST_DATA_KEYS.COMPLETED_TASKS,
      GUEST_DATA_KEYS.STREAK_DATA,
      GUEST_DATA_KEYS.TASK_TIMERS,
      GUEST_DATA_KEYS.USER,
    ];

    // Optionally keep subscription data for RevenueCat sync
    if (!keepSubscription) {
      keysToRemove.push(GUEST_DATA_KEYS.SUBSCRIPTION);
    }

    await AsyncStorage.multiRemove(keysToRemove);
    console.log('[Migration] Guest data cleared successfully');
  } catch (error) {
    console.error('[Migration] Error clearing guest data:', error);
  }
}

/**
 * Backup guest data before migration (safety)
 */
export async function backupGuestData(): Promise<void> {
  console.log('[Migration] Backing up guest data...');
  
  try {
    const guestData = await collectGuestData();
    await AsyncStorage.setItem(
      'ambitionly_guest_backup',
      JSON.stringify({
        backedUpAt: new Date().toISOString(),
        data: guestData,
      })
    );
    console.log('[Migration] Guest data backed up');
  } catch (error) {
    console.error('[Migration] Error backing up guest data:', error);
  }
}

/**
 * Restore guest data from backup (if migration fails)
 */
export async function restoreGuestDataFromBackup(): Promise<boolean> {
  console.log('[Migration] Restoring from backup...');
  
  try {
    const backup = await AsyncStorage.getItem('ambitionly_guest_backup');
    if (!backup) {
      console.log('[Migration] No backup found');
      return false;
    }

    const { data } = JSON.parse(backup);
    
    // Restore all data
    await Promise.all([
      data.goal && AsyncStorage.setItem(GUEST_DATA_KEYS.GOAL, data.goal),
      data.timeline && AsyncStorage.setItem(GUEST_DATA_KEYS.TIMELINE, data.timeline),
      data.timeCommitment && AsyncStorage.setItem(GUEST_DATA_KEYS.TIME_COMMITMENT, data.timeCommitment),
      data.answers && AsyncStorage.setItem(GUEST_DATA_KEYS.ANSWERS, JSON.stringify(data.answers)),
      data.roadmap && AsyncStorage.setItem(GUEST_DATA_KEYS.ROADMAP, JSON.stringify(data.roadmap)),
      data.completedTasks && AsyncStorage.setItem(GUEST_DATA_KEYS.COMPLETED_TASKS, JSON.stringify(data.completedTasks)),
      data.streakData && AsyncStorage.setItem(GUEST_DATA_KEYS.STREAK_DATA, JSON.stringify(data.streakData)),
      data.taskTimers && AsyncStorage.setItem(GUEST_DATA_KEYS.TASK_TIMERS, JSON.stringify(data.taskTimers)),
    ]);

    console.log('[Migration] Data restored from backup');
    return true;
  } catch (error) {
    console.error('[Migration] Error restoring from backup:', error);
    return false;
  }
}

