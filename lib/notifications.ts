import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Configure notification behavior only if not in Expo Go
if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.warn('[Notifications] Failed to set notification handler:', error);
  }
}

// Minimum time in the future for scheduling notifications (5 seconds)
const MINIMUM_FUTURE_TIME_MS = 5000;

// Note: App icons for notifications are configured in app.json
// Android: Uses app launcher icon automatically from app.json "icon" and android.adaptiveIcon
// iOS: Uses app icon automatically from app bundle
// No custom icon loading needed - Expo handles this automatically

export class NotificationService {
  private static hasPermission = false;
  private static isInitialized = false;
  private static activeNotificationIds = new Set<string>();

  static async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.hasPermission;
    }

    try {
      if (Platform.OS === 'web') {
        console.log('[Notifications] Web platform - notifications not supported');
        this.isInitialized = true;
        return false;
      }

      // Check if running in Expo Go
      if (isExpoGo) {
        console.log('[Notifications] Expo Go detected - notifications disabled for compatibility');
        this.isInitialized = true;
        this.hasPermission = false;
        return false;
      }

      // Android-specific initialization - create task-timers channel first
      if (Platform.OS === 'android') {
        try {
          // Create the task-timers channel with HIGH importance
          await Notifications.setNotificationChannelAsync('task-timers', {
            name: 'Task Timers',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
            enableVibrate: true,
            showBadge: false,
          });
          console.log('[Notifications] ✅ Task timers channel created');
        } catch (androidError) {
          console.warn('[Notifications] Android channel setup failed:', androidError);
        }
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: false,
            allowSound: true,
            allowAnnouncements: false,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted:', finalStatus);
        this.hasPermission = false;
      } else {
        console.log('[Notifications] ✅ Permission granted');
        this.hasPermission = true;
      }

      this.isInitialized = true;
      return this.hasPermission;
    } catch (error) {
      console.error('[Notifications] Error initializing:', error);
      this.isInitialized = true;
      this.hasPermission = false;
      return false;
    }
  }

  /**
   * Schedule a notification for when a task timer completes
   * @param taskTitle - Title of the task
   * @param triggerInSeconds - Number of seconds from now to trigger the notification (MUST be >= 5 seconds)
   * @param taskId - Optional task ID for tracking
   * @returns Notification ID or null if scheduling failed
   */
  static async scheduleTaskCompleteNotification(
    taskTitle: string,
    triggerInSeconds: number,
    taskId?: string
  ): Promise<string | null> {
    // CRITICAL: Validate trigger time - must be at least 5 seconds in the future
    if (!triggerInSeconds || triggerInSeconds < 5 || isNaN(triggerInSeconds) || !isFinite(triggerInSeconds)) {
      console.error('[Notifications] ❌ Invalid triggerInSeconds:', triggerInSeconds, '- must be >= 5 seconds. Notification will NOT be scheduled.');
      return null;
    }

    try {
      // Web platform - use browser notifications
      if (Platform.OS === 'web') {
        if ('Notification' in window && Notification.permission === 'granted') {
          setTimeout(() => {
            new Notification('Task Timer Complete! ⏰', {
              body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
              icon: '/favicon.png',
              tag: `task-complete-${taskId || Date.now()}`,
            });
          }, triggerInSeconds * 1000);
          const notificationId = `web-notification-${Date.now()}`;
          this.activeNotificationIds.add(notificationId);
          console.log(`[Notifications] ✅ Web notification scheduled for ${triggerInSeconds} seconds`);
          return notificationId;
        }
        return null;
      }

      // Expo Go - notifications not supported
      if (isExpoGo) {
        console.log('[Notifications] Expo Go detected - notification scheduling disabled');
        return null;
      }

      // Ensure we have permission
      if (!this.hasPermission) {
        const hasPermission = await this.initialize();
        if (!hasPermission) {
          console.warn('[Notifications] No permission to send notifications');
          return null;
        }
      }

      // Calculate exact trigger time
      const now = Date.now();
      const triggerTimeMs = triggerInSeconds * 1000;
      const triggerTime = now + triggerTimeMs;
      const triggerDate = new Date(triggerTime);

      // Validate trigger is in the future with minimum buffer
      const minimumTriggerTime = now + MINIMUM_FUTURE_TIME_MS;
      if (triggerDate.getTime() < minimumTriggerTime) {
        console.error('[Notifications] ❌ Trigger time is too soon - must be at least 5 seconds in the future');
        return null;
      }

      // Create unique identifier for this notification
      const safeTaskTitle = taskTitle.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
      const notificationIdentifier = `task-timer-${safeTaskTitle}-${taskId || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const safeTriggerSeconds = Math.max(5, Math.round(triggerInSeconds));
      
      // Use proper timeInterval trigger format with explicit type
      // This ensures the notification fires after the specified seconds, not immediately
      // Using 'timeInterval' type explicitly prevents the notification from firing immediately
      const notificationTrigger = {
        type: 'timeInterval' as const,
        seconds: safeTriggerSeconds,
        repeats: false,
      } as Notifications.TimeIntervalTriggerInput;
      
      // Schedule the notification
      try {
        // Build notification content
        // Android: App icon is used automatically from app.json/AndroidManifest
        // iOS: App icon appears automatically from app bundle
        const notificationContent: Notifications.NotificationContentInput = {
          title: 'Task Timer Complete! ⏰',
          body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: 'task-timer-complete',
            taskTitle,
            taskId: taskId || null,
            scheduledAt: now,
            triggerInSeconds: safeTriggerSeconds,
          },
          ...(Platform.OS === 'android' && { 
            channelId: 'task-timers',
            // Android uses app icon automatically from app.json icon configuration
          }),
        };

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: notificationTrigger,
          identifier: notificationIdentifier,
        });

        // Track this notification
        this.activeNotificationIds.add(notificationId);

        const expectedTriggerTime = new Date(now + safeTriggerSeconds * 1000);
        console.log(`[Notifications] ✅ Notification scheduled successfully:`);
        console.log(`  - Notification ID: ${notificationId}`);
        console.log(`  - Identifier: ${notificationIdentifier}`);
        console.log(`  - Task: "${taskTitle}" (ID: ${taskId || 'unknown'})`);
        console.log(`  - Trigger type: timeInterval`);
        console.log(`  - Trigger: ${safeTriggerSeconds} seconds from now`);
        console.log(`  - Expected trigger time: ${expectedTriggerTime.toISOString()}`);
        console.log(`  - Current time: ${new Date(now).toISOString()}`);
        
        return notificationId;
      } catch (scheduleError) {
        console.error('[Notifications] ❌ Error scheduling notification:', scheduleError);
        return null;
      }
    } catch (error) {
      console.error('[Notifications] ❌ Error in scheduleTaskCompleteNotification:', error);
      return null;
    }
  }

  /**
   * Send an immediate notification (ONLY use when timer has actually completed and scheduled notification failed)
   * This should ONLY be called when the timer has actually completed and we need a fallback
   */
  static async sendImmediateNotification(taskTitle: string, taskId?: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Task Timer Complete! ⏰', {
            body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
            icon: '/favicon.png',
            tag: `task-complete-immediate-${taskId || Date.now()}`,
          });
          console.log('[Notifications] ✅ Immediate web notification sent');
          return `web-notification-immediate-${Date.now()}`;
        }
        return null;
      }

      if (isExpoGo || !this.hasPermission) {
        return null;
      }

      const safeTaskTitle = taskTitle.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
      const notificationIdentifier = `task-timer-immediate-${safeTaskTitle}-${taskId || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Build notification content
      // Android: App icon is used automatically from app.json/AndroidManifest
      // iOS: App icon appears automatically from app bundle
      const notificationContent: Notifications.NotificationContentInput = {
        title: 'Task Timer Complete! ⏰',
        body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: 'task-timer-complete',
          taskTitle,
          taskId: taskId || null,
          immediate: true,
        },
        ...(Platform.OS === 'android' && { 
          channelId: 'task-timers',
          // Android uses app icon automatically from app.json icon configuration
        }),
      };
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Immediate
        identifier: notificationIdentifier,
      });

      this.activeNotificationIds.add(notificationId);
      console.log(`[Notifications] ✅ Immediate notification sent. ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('[Notifications] ❌ Error sending immediate notification:', error);
      return null;
    }
  }

  static async cancelNotification(notificationId: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || isExpoGo || !notificationId) {
        return;
      }

      // Remove from tracking
      this.activeNotificationIds.delete(notificationId);

      // Try to cancel by ID first
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        console.log(`[Notifications] ✅ Cancelled notification: ${notificationId}`);
        return;
      } catch (error) {
        // If that fails, try to find it by identifier pattern
        console.warn(`[Notifications] Could not cancel notification by ID ${notificationId}, trying to find by identifier...`);
      }

      // Fallback: Get all scheduled notifications and cancel matching ones
      const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const matchingNotifications = allNotifications.filter(n => 
        n.identifier?.includes(notificationId) || 
        n.content?.data?.taskId === notificationId
      );

      for (const notification of matchingNotifications) {
        if (notification.identifier) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          this.activeNotificationIds.delete(notification.identifier);
          console.log(`[Notifications] ✅ Cancelled notification by identifier: ${notification.identifier}`);
        }
      }
    } catch (error) {
      console.error('[Notifications] ❌ Error cancelling notification:', error);
    }
  }

  static async cancelAllTaskTimerNotifications(): Promise<void> {
    try {
      if (Platform.OS === 'web' || isExpoGo) {
        return;
      }

      const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const taskTimerNotifications = allNotifications.filter(
        (notification) => 
          notification.identifier?.startsWith('task-timer-') ||
          notification.content?.data?.type === 'task-timer-complete'
      );

      for (const notification of taskTimerNotifications) {
        if (notification.identifier) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          this.activeNotificationIds.delete(notification.identifier);
        }
      }

      console.log(`[Notifications] ✅ Cancelled ${taskTimerNotifications.length} task timer notifications`);
    } catch (error) {
      console.error('[Notifications] ❌ Error cancelling task timer notifications:', error);
    }
  }

  static async requestWebNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'web' || !('Notification' in window)) {
      return false;
    }

    try {
      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission === 'denied') {
        return false;
      }

      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('[Notifications] Error requesting web permission:', error);
      return false;
    }
  }

  /**
   * Get all scheduled notifications (for debugging)
   */
  static async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      if (Platform.OS === 'web' || isExpoGo) {
        return [];
      }
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('[Notifications] Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Check if a notification ID is still active
   */
  static isNotificationActive(notificationId: string): boolean {
    return this.activeNotificationIds.has(notificationId);
  }

  /**
   * Get count of active notifications
   */
  static getActiveNotificationCount(): number {
    return this.activeNotificationIds.size;
  }
}

// Initialize on import for mobile platforms (with better error handling)
if (Platform.OS !== 'web') {
  // Only initialize if not in Expo Go to prevent errors
  if (!isExpoGo) {
    NotificationService.initialize().catch(error => {
      console.warn('[Notifications] Initialization failed:', error);
    });
  } else {
    console.log('[Notifications] Skipping initialization in Expo Go');
  }
} else {
  // For web, request permission when user interacts
  NotificationService.requestWebNotificationPermission();
}