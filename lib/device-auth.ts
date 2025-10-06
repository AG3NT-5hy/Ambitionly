import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'ambitionly_device_id';

export class DeviceAuth {
  private static deviceId: string | null = null;

  static async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    // Try to get stored device ID first
    const storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedId) {
      this.deviceId = storedId;
      return storedId;
    }

    // Generate new device ID
    let deviceId: string;
    
    if (Platform.OS === 'web') {
      // For web, create a unique ID based on browser fingerprint
      const userAgent = navigator.userAgent;
      const language = navigator.language;
      const platform = navigator.platform;
      const seed = `${userAgent}-${language}-${platform}-${Date.now()}`;
      
      // Simple hash function for web
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      deviceId = `web_${Math.abs(hash).toString(16)}`;
    } else {
      // For mobile, use application instance ID or generate one
      try {
        const instanceId = await Application.getInstallationTimeAsync();
        deviceId = `mobile_${instanceId.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
      } catch (error) {
        console.warn('Failed to get installation time, generating fallback:', error);
        deviceId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    }

    // Store the device ID
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    this.deviceId = deviceId;
    
    console.log(`[DeviceAuth] Generated device ID: ${deviceId}`);
    return deviceId;
  }

  static async clearDeviceId(): Promise<void> {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
    this.deviceId = null;
  }
}