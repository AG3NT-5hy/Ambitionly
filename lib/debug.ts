import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import type { SubscriptionState } from '../hooks/subscription-store'

export interface DebugInfo {
  app: {
    name: string;
    version: string;
    buildNumber?: string;
    bundleId?: string;
    nativeVersion?: string;
  };
  device: {
    platform: string;
    osVersion: string;
    deviceName?: string;
    modelName?: string;
    brand?: string;
    isDevice: boolean;
  };
  network: {
    isConnected: boolean;
    type?: string;
    isInternetReachable?: boolean;
  };
  storage: {
    keys: string[];
    totalSize: number;
  };
  auth: {
    isAuthenticated: boolean;
    userId?: string;
    lastLoginDate?: string;
  };
  entitlements: {
    isPremium: boolean;
    subscriptionStatus?: string;
    expiryDate?: string;
  };
  errors: {
    lastError?: string;
    errorCount: number;
    lastErrorDate?: string;
  };
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  data?: any;
}

class DebugService {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private isOfflineMode = false;
  private lastError: string | null = null;
  private errorCount = 0;
  private lastErrorDate: string | null = null;

  constructor() {
    this.loadStoredLogs();
  }

  private async loadStoredLogs() {
    try {
      const stored = await AsyncStorage.getItem('debug_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored logs:', error);
    }
  }

  private async persistLogs() {
    try {
      // Keep only recent logs to prevent storage bloat
      const recentLogs = this.logs.slice(-this.maxLogs);
      await AsyncStorage.setItem('debug_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Failed to persist logs:', error);
    }
  }

  log(level: LogEntry['level'], tag: string, message: string, data?: any) {
    const entry: LogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      tag,
      message,
      data,
    };

    this.logs.push(entry);

    // Track errors
    if (level === 'error') {
      this.lastError = message;
      this.errorCount++;
      this.lastErrorDate = new Date().toISOString();
    }

    // Console output in development
    if (__DEV__) {
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       level === 'info' ? console.info : console.log;
      
      logMethod(`[${tag}] ${message}`, data || '');
    }

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist periodically
    if (this.logs.length % 10 === 0) {
      this.persistLogs();
    }
  }

  debug(tag: string, message: string, data?: any) {
    if (!tag?.trim() || tag.length > 100) return;
    if (!message?.trim() || message.length > 1000) return;
    this.log('debug', tag.trim(), message.trim(), data);
  }

  info(tag: string, message: string, data?: any) {
    if (!tag?.trim() || tag.length > 100) return;
    if (!message?.trim() || message.length > 1000) return;
    this.log('info', tag.trim(), message.trim(), data);
  }

  warn(tag: string, message: string, data?: any) {
    if (!tag?.trim() || tag.length > 100) return;
    if (!message?.trim() || message.length > 1000) return;
    this.log('warn', tag.trim(), message.trim(), data);
  }

  error(tag: string, message: string, data?: any) {
    if (!tag?.trim() || tag.length > 100) return;
    if (!message?.trim() || message.length > 1000) return;
    this.log('error', tag.trim(), message.trim(), data);
  }

  getLogs(level?: LogEntry['level'], tag?: string, limit = 100): LogEntry[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (tag) {
      filtered = filtered.filter(log => log.tag === tag);
    }

    return filtered.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
    AsyncStorage.removeItem('debug_logs');
  }

  toggleOfflineMode() {
    this.isOfflineMode = !this.isOfflineMode;
    this.info('Debug', `Offline mode ${this.isOfflineMode ? 'enabled' : 'disabled'}`);
  }

  getOfflineMode(): boolean {
    return this.isOfflineMode;
  }

  async getDebugInfo(): Promise<DebugInfo> {
    try {
      // Get network info
      const netInfo = await NetInfo.fetch();
      
      // Get storage info
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      try {
        const items = await AsyncStorage.multiGet(keys);
        totalSize = items.reduce((size, [, value]) => {
          return size + (value ? value.length : 0);
        }, 0);
      } catch {
        // Ignore storage size calculation errors
      }

      // Get subscription state from storage
      let subscriptionState: SubscriptionState | null = null;
      try {
        const storedSubscription = await AsyncStorage.getItem('ambitionly_subscription_state');
        if (storedSubscription) {
          subscriptionState = JSON.parse(storedSubscription);
          // Convert date strings back to Date objects for validation
          if (subscriptionState?.expiresAt) {
            subscriptionState.expiresAt = new Date(subscriptionState.expiresAt);
          }
          if (subscriptionState?.purchasedAt) {
            subscriptionState.purchasedAt = new Date(subscriptionState.purchasedAt);
          }
        }
      } catch (error) {
        this.warn('Debug', 'Failed to load subscription state for debug info', error);
      }

      // Check if subscription is still active
      const isSubscriptionActive = subscriptionState?.isActive && 
        (!subscriptionState.expiresAt || new Date() <= subscriptionState.expiresAt);

      // Get app info
      const appInfo = {
        name: Constants.expoConfig?.name || 'Unknown',
        version: Constants.expoConfig?.version || '1.0.0',
        buildNumber: Platform.select({
          ios: Application.nativeBuildVersion || undefined,
          android: Application.nativeBuildVersion || undefined,
          default: undefined,
        }),
        bundleId: Platform.select({
          ios: Application.applicationId || undefined,
          android: Application.applicationId || undefined,
          default: undefined,
        }),
        nativeVersion: Platform.select({
          ios: Application.nativeApplicationVersion || undefined,
          android: Application.nativeApplicationVersion || undefined,
          default: undefined,
        }),
      };

      // Get device info
      const deviceInfo = {
        platform: Platform.OS,
        osVersion: Platform.Version.toString(),
        deviceName: Platform.select({
          web: 'Web Browser',
          default: Device.deviceName || 'Unknown',
        }),
        modelName: Device.modelName || 'Unknown',
        brand: Device.brand || 'Unknown',
        isDevice: Device.isDevice || false,
      };

      return {
        app: appInfo,
        device: deviceInfo,
        network: {
          isConnected: netInfo.isConnected || false,
          type: netInfo.type || 'unknown',
          isInternetReachable: netInfo.isInternetReachable || false,
        },
        storage: {
          keys: [...keys],
          totalSize,
        },
        auth: {
          isAuthenticated: !!subscriptionState, // User is "authenticated" if they have subscription data
          userId: subscriptionState ? `user_${subscriptionState.plan}_${subscriptionState.purchasedAt?.getTime() || 'unknown'}` : undefined,
          lastLoginDate: subscriptionState?.purchasedAt?.toISOString() || undefined,
        },
        entitlements: {
          isPremium: isSubscriptionActive || false,
          subscriptionStatus: subscriptionState?.plan || undefined,
          expiryDate: subscriptionState?.expiresAt?.toISOString() || undefined,
        },
        errors: {
          lastError: this.lastError || undefined,
          errorCount: this.errorCount,
          lastErrorDate: this.lastErrorDate || undefined,
        },
      };
    } catch (error) {
      this.error('Debug', 'Failed to get debug info', error);
      throw error;
    }
  }

  exportLogs(): string {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      logs: this.logs,
      isOfflineMode: this.isOfflineMode,
    };
    
    return JSON.stringify(debugInfo, null, 2);
  }
}

export const debugService = new DebugService();

// Convenience functions
export const log = {
  debug: (tag: string, message: string, data?: any) => {
    if (!tag?.trim() || !message?.trim()) return;
    debugService.debug(tag, message, data);
  },
  info: (tag: string, message: string, data?: any) => {
    if (!tag?.trim() || !message?.trim()) return;
    debugService.info(tag, message, data);
  },
  warn: (tag: string, message: string, data?: any) => {
    if (!tag?.trim() || !message?.trim()) return;
    debugService.warn(tag, message, data);
  },
  error: (tag: string, message: string, data?: any) => {
    if (!tag?.trim() || !message?.trim()) return;
    debugService.error(tag, message, data);
  },
};