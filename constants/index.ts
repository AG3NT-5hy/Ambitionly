// App Configuration Constants
export const APP_CONFIG = {
  API_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  GC_TIME: 10 * 60 * 1000, // 10 minutes
} as const;

// RevenueCat Configuration
// Note: API keys are configured in app/_layout.tsx
// Android: Configured with Google Play key (goog_ADevXcaXkfzYBrgyWGbCXcRsqzh)
// iOS: Not yet configured (placeholder key in place)
export const REVENUECAT_CONFIG = {
  ANDROID_CONFIGURED: true,
  IOS_CONFIGURED: false,
  REQUIRES_DEV_BUILD: true, // RevenueCat doesn't work in Expo Go
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  GOAL: 'ambitionly_goal',
  TIMELINE: 'ambitionly_timeline',
  TIME_COMMITMENT: 'ambitionly_time_commitment',
  ANSWERS: 'ambitionly_answers',
  ROADMAP: 'ambitionly_roadmap',
  COMPLETED_TASKS: 'ambitionly_completed_tasks',
  STREAK_DATA: 'ambitionly_streak_data',
  TASK_TIMERS: 'ambitionly_task_timers',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  LLM: 'https://toolkit.rork.com/text/llm/',
  IMAGE_GENERATE: 'https://toolkit.rork.com/images/generate/',
  IMAGE_EDIT: 'https://toolkit.rork.com/images/edit/',
  STT: 'https://toolkit.rork.com/stt/transcribe/',
} as const;

// Colors
export const COLORS = {
  PRIMARY: '#00E6E6',
  SECONDARY: '#6C63FF',
  ACCENT: '#3DBEFF',
  SUCCESS: '#32D583',
  ERROR: '#FF6B6B',
  WARNING: '#FFB800',
  
  BACKGROUND: '#000000',
  SURFACE: '#1A1A1A',
  BORDER: '#2D2D2D',
  
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#E0E0E0',
  TEXT_MUTED: '#9A9A9A',
  TEXT_DISABLED: '#666666',
  
  GRADIENT_PRIMARY: ['#6C63FF', '#3DBEFF', '#00E6E6'],
  GRADIENT_BACKGROUND: ['#000000', '#29202B'],
} as const;

// Validation Rules
export const VALIDATION = {
  GOAL_MIN_LENGTH: 3,
  GOAL_MAX_LENGTH: 200,
  ANSWER_MAX_LENGTH: 500,
  TIMELINE_OPTIONS: ['1 week', '2 weeks', '1 month', '3 months', '6 months', '1 year'],
  TIME_COMMITMENT_OPTIONS: ['15 min/day', '30 min/day', '1 hour/day', '2 hours/day', '3+ hours/day'],
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_ANALYTICS: false,
  ENABLE_CRASH_REPORTING: false,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_PUSH_NOTIFICATIONS: false,
} as const;

// Development flags
export const DEV_CONFIG = {
  ENABLE_DEBUG_LOGS: __DEV__,
  SHOW_PERFORMANCE_MONITOR: __DEV__,
  ENABLE_FLIPPER: __DEV__,
} as const;

// Connection Status Helper
export async function checkConnections() {
  const status = {
    supabase: false,
    database: false,
    license: false,
  };
  
  try {
    // Check Supabase
    const { supabase } = await import('../lib/supabase');
    const { error } = await supabase.auth.getSession();
    status.supabase = !error;
  } catch (e) {
    console.error('Supabase check failed:', e);
  }
  
  return status;
}