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

export class NotificationService {
  private static hasPermission = false;
  private static isInitialized = false;

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

      // Android-specific initialization
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        } catch (androidError) {
          console.warn('[Notifications] Android channel setup failed:', androidError);
          // Continue with initialization even if channel setup fails
        }
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        this.hasPermission = false;
      } else {
        console.log('[Notifications] Permission granted');
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

  static async scheduleTaskCompleteNotification(
    taskTitle: string,
    triggerInSeconds?: number
  ): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // Fallback for web - show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          if (triggerInSeconds && triggerInSeconds > 0) {
            // Schedule for future
            setTimeout(() => {
              new Notification('Task Timer Complete! ⏰', {
                body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
                icon: '/favicon.png',
                tag: 'task-complete',
              });
            }, triggerInSeconds * 1000);
          } else {
            // Show immediately
            new Notification('Task Timer Complete! ⏰', {
              body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
              icon: '/favicon.png',
              tag: 'task-complete',
            });
          }
        } else {
          console.log('[Notifications] Web notifications not available or not permitted');
        }
        return null;
      }

      if (isExpoGo) {
        console.log('[Notifications] Expo Go detected - notification scheduling disabled');
        return null;
      }

      if (!this.hasPermission) {
        console.log('[Notifications] No permission to send notifications');
        return null;
      }

      // Android-specific notification handling
      if (Platform.OS === 'android') {
        try {
          // Ensure notification channel exists with HIGH importance for better reliability
          const channels = await Notifications.getNotificationChannelsAsync();
          const defaultChannel = channels.find(channel => channel.id === 'task-timers');
          if (!defaultChannel) {
            await Notifications.setNotificationChannelAsync('task-timers', {
              name: 'Task Timers',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
              sound: 'default',
              enableVibrate: true,
              showBadge: false,
            });
          }
        } catch (channelError) {
          console.warn('[Notifications] Android channel check failed:', channelError);
        }
      }

      // Determine trigger - if triggerInSeconds is provided, schedule for future
      let trigger: Notifications.NotificationTriggerInput | null = null;
      if (triggerInSeconds && triggerInSeconds > 0) {
        // Use exact date/time for better reliability
        // Add a small buffer to ensure it's in the future
        const triggerDate = new Date(Date.now() + triggerInSeconds * 1000);
        // Ensure trigger is at least 1 second in the future
        if (triggerDate.getTime() <= Date.now() + 1000) {
          triggerDate.setTime(Date.now() + 1000);
        }
        trigger = {
          date: triggerDate,
        };
        console.log(`[Notifications] Scheduling notification for ${triggerInSeconds} seconds (${triggerDate.toISOString()})`);
      } else {
        // If no trigger specified, this should not be called for scheduled notifications
        console.warn('[Notifications] scheduleTaskCompleteNotification called without triggerInSeconds - notification will be sent immediately');
      }

      const notificationIdentifier = `task-timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Task Timer Complete! ⏰',
          body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: 'task-timer-complete',
            taskTitle,
          },
          ...(Platform.OS === 'android' && { channelId: 'task-timers' }),
        },
        trigger: trigger, // null for immediate, or date for scheduled
        identifier: notificationIdentifier,
      });

      if (trigger) {
        console.log(`[Notifications] Task complete notification scheduled successfully. ID: ${notificationId}, Identifier: ${notificationIdentifier}, Trigger: ${triggerInSeconds} seconds`);
      } else {
        console.log(`[Notifications] Task complete notification sent immediately. ID: ${notificationId}`);
      }
      
      return notificationId;
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
      return null;
    }
  }

  static async cancelNotification(notificationId: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || isExpoGo) {
        return;
      }

      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`[Notifications] Cancelled notification: ${notificationId}`);
    } catch (error) {
      console.error('[Notifications] Error cancelling notification:', error);
    }
  }

  static async cancelAllTaskTimerNotifications(): Promise<void> {
    try {
      if (Platform.OS === 'web' || isExpoGo) {
        return;
      }

      const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const taskTimerNotifications = allNotifications.filter(
        (notification) => notification.identifier?.startsWith('task-timer-') ||
                         notification.content?.data?.type === 'task-timer-complete'
      );

      for (const notification of taskTimerNotifications) {
        if (notification.identifier) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }

      console.log(`[Notifications] Cancelled ${taskTimerNotifications.length} task timer notifications`);
    } catch (error) {
      console.error('[Notifications] Error cancelling task timer notifications:', error);
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