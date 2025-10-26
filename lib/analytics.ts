import { Platform } from 'react-native';
import { debugService } from './debug';

export type AnalyticsEvent = 
  | 'app_opened'
  | 'sign_up'
  | 'sign_in'
  | 'paywall_viewed'
  | 'purchase_started'
  | 'purchase_succeeded'
  | 'purchase_failed'
  | 'restore_purchases'
  | 'restore_purchases_succeeded'
  | 'restore_purchases_failed'
  | 'feature_used_goal_setting'
  | 'feature_used_roadmap_generation'
  | 'feature_used_task_timer'
  | 'feature_used_task_completion'
  | 'feature_used_progress_view'
  | 'feature_used_settings'
  | 'feature_used_reset_progress'
  | 'feature_used_clear_data'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'roadmap_generated'
  | 'task_started'
  | 'task_completed'
  | 'streak_achieved'
  | 'milestone_completed'
  | 'phase_completed'
  | 'error_occurred'
  | 'crash_reported'
  | 'dev_settings_accessed';

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | undefined;
}

export interface AnalyticsProvider {
  identify(userId: string, properties?: AnalyticsProperties): void;
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void;
  screen(screenName: string, properties?: AnalyticsProperties): void;
  flush(): Promise<void>;
}

// Mock analytics provider for development
class MockAnalyticsProvider implements AnalyticsProvider {
  identify(userId: string, properties?: AnalyticsProperties): void {
    const sanitizedProperties = properties ? { ...properties } : undefined;
    debugService.info('Analytics', `Identify: ${userId}`, sanitizedProperties);
  }

  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    const sanitizedProperties = properties ? { ...properties } : undefined;
    debugService.info('Analytics', `Track: ${event}`, sanitizedProperties);
  }

  screen(screenName: string, properties?: AnalyticsProperties): void {
    const sanitizedProperties = properties ? { ...properties } : undefined;
    debugService.info('Analytics', `Screen: ${screenName}`, sanitizedProperties);
  }

  async flush(): Promise<void> {
    debugService.info('Analytics', 'Flush called');
  }
}

// Console analytics provider for debugging
class ConsoleAnalyticsProvider implements AnalyticsProvider {
  identify(userId: string, properties?: AnalyticsProperties): void {
    const sanitizedProperties = properties ? { ...properties } : undefined;
    console.log('🔍 Analytics Identify:', { userId, properties: sanitizedProperties });
  }

  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    console.log('📊 Analytics Track:', { event, properties, timestamp: new Date().toISOString() });
  }

  screen(screenName: string, properties?: AnalyticsProperties): void {
    console.log('📱 Analytics Screen:', { screenName, properties, timestamp: new Date().toISOString() });
  }

  async flush(): Promise<void> {
    console.log('🚀 Analytics Flush');
  }
}

// Amplitude provider (example implementation - not used but kept for reference)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class AmplitudeProvider implements AnalyticsProvider {
  private apiKey: string;
  private userId?: string;
  private events: { event: string; properties?: any; timestamp: number }[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  identify(userId: string, properties?: AnalyticsProperties): void {
    this.userId = userId;
    const sanitizedProperties = properties ? { ...properties } : undefined;
    // In a real implementation, you would call Amplitude's identify method
    debugService.info('Amplitude', `Identify: ${userId}`, sanitizedProperties);
  }

  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    const eventData = {
      event,
      properties: {
        ...properties,
        platform: Platform.OS,
        timestamp: Date.now(),
        userId: this.userId,
      },
      timestamp: Date.now(),
    };

    this.events.push(eventData);
    
    // In a real implementation, you would send this to Amplitude
    debugService.info('Amplitude', `Track: ${event}`, eventData);
    
    // Auto-flush if we have too many events
    if (this.events.length >= 10) {
      this.flush();
    }
  }

  screen(screenName: string, properties?: AnalyticsProperties): void {
    this.track('feature_used_screen_view' as AnalyticsEvent, {
      screen_name: screenName,
      ...properties,
    });
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    try {
      // In a real implementation, you would send events to Amplitude API
      debugService.info('Amplitude', `Flushing ${this.events.length} events`);
      
      // Simulate API call
      await new Promise(resolve => {
        if (typeof resolve === 'function') {
          setTimeout(resolve, 100);
        }
      });
      
      this.events = [];
    } catch (error) {
      debugService.error('Amplitude', 'Failed to flush events', error);
    }
  }
}

class AnalyticsService {
  private provider: AnalyticsProvider;
  private isEnabled: boolean = true;
  private sessionId: string;
  private sessionStartTime: number;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    
    // Initialize provider based on environment
    if (__DEV__) {
      this.provider = new ConsoleAnalyticsProvider();
    } else {
      // In production, use a no-op provider to avoid crashes
      // Analytics can be added later with proper provider
      this.provider = new MockAnalyticsProvider();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setProvider(provider: AnalyticsProvider): void {
    this.provider = provider;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    debugService.info('Analytics', `Analytics ${enabled ? 'enabled' : 'disabled'}`);
  }

  identify(userId: string, properties?: AnalyticsProperties): void {
    if (!this.isEnabled) return;
    
    try {
      this.provider.identify(userId, {
        ...properties,
        session_id: this.sessionId,
        platform: Platform.OS,
      });
    } catch (error) {
      debugService.error('Analytics', 'Failed to identify user', error);
    }
  }

  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    if (!this.isEnabled) return;
    if (!event?.trim()) return;
    
    try {
      const sanitizedProperties = properties ? { ...properties } : undefined;
      this.provider.track(event, {
        ...sanitizedProperties,
        session_id: this.sessionId,
        session_duration: Date.now() - this.sessionStartTime,
        platform: Platform.OS,
        timestamp: Date.now(),
      });
    } catch (error) {
      debugService.error('Analytics', 'Failed to track event', error);
    }
  }

  screen(screenName: string, properties?: AnalyticsProperties): void {
    if (!this.isEnabled) return;
    if (!screenName?.trim()) return;
    
    try {
      const sanitizedProperties = properties ? { ...properties } : undefined;
      this.provider.screen(screenName.trim(), {
        ...sanitizedProperties,
        session_id: this.sessionId,
        platform: Platform.OS,
      });
    } catch (error) {
      debugService.error('Analytics', 'Failed to track screen', error);
    }
  }

  async flush(): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      await this.provider.flush();
    } catch (error) {
      debugService.error('Analytics', 'Failed to flush analytics', error);
    }
  }

  // Convenience methods for common events
  trackAppOpened(): void {
    this.track('app_opened', {
      session_start: true,
    });
  }

  trackFeatureUsed(featureName: string, properties?: AnalyticsProperties): void {
    if (!featureName?.trim()) return;
    const sanitizedProperties = properties ? { ...properties } : undefined;
    this.track(`feature_used_${featureName}` as AnalyticsEvent, sanitizedProperties);
  }

  trackError(error: Error, context?: string): void {
    this.track('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      context,
    });
  }

  trackTaskCompleted(taskId: string, duration: number): void {
    this.track('task_completed', {
      task_id: taskId,
      duration_ms: duration,
    });
  }

  trackRoadmapGenerated(goal: string, timeline: string, timeCommitment: string): void {
    this.track('roadmap_generated', {
      goal_length: goal.length,
      timeline,
      time_commitment: timeCommitment,
    });
  }

  trackStreakAchieved(streakCount: number): void {
    this.track('streak_achieved', {
      streak_count: streakCount,
    });
  }

  // Session management
  startNewSession(): void {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    debugService.info('Analytics', `New session started: ${this.sessionId}`);
  }

  getSessionInfo(): { sessionId: string; duration: number } {
    return {
      sessionId: this.sessionId,
      duration: Date.now() - this.sessionStartTime,
    };
  }
}

export const analytics = new AnalyticsService();

// Hook for React components
export function useAnalytics() {
  return {
    track: analytics.track.bind(analytics),
    screen: analytics.screen.bind(analytics),
    identify: analytics.identify.bind(analytics),
    trackFeatureUsed: analytics.trackFeatureUsed.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
  };
}