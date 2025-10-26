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

  static async scheduleTaskCompleteNotification(taskTitle: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Fallback for web - show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Task Timer Complete! ⏰', {
            body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
            icon: '/favicon.png',
            tag: 'task-complete',
          });
        } else {
          console.log('[Notifications] Web notifications not available or not permitted');
        }
        return;
      }

      if (isExpoGo) {
        console.log('[Notifications] Expo Go detected - notification scheduling disabled');
        return;
      }

      if (!this.hasPermission) {
        console.log('[Notifications] No permission to send notifications');
        return;
      }

      // Android-specific notification handling
      if (Platform.OS === 'android') {
        try {
          // Ensure notification channel exists before scheduling
          const channels = await Notifications.getNotificationChannelsAsync();
          if (!channels.find(channel => channel.id === 'default')) {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.DEFAULT,
            });
          }
        } catch (channelError) {
          console.warn('[Notifications] Android channel check failed:', channelError);
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Task Timer Complete! ⏰',
          body: `"${taskTitle}" timer is finished. Time to move on to the next task!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });

      console.log('[Notifications] Task complete notification sent');
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
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