import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { analytics } from '@/lib/analytics';

export type SubscriptionPlan = 'free' | 'monthly' | 'annual' | 'lifetime';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  isActive: boolean;
  expiresAt?: Date;
  purchasedAt?: Date;
}

const STORAGE_KEYS = {
  SUBSCRIPTION_STATE: 'ambitionly_subscription_state',
};

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [subscriptionState, setSubscriptionStateInternal] = useState<SubscriptionState>({
    plan: 'free',
    isActive: false,
  });

  // Load subscription state from storage on init
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_STATE);
        
        if (!isMounted) return;

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Convert date strings back to Date objects
            if (parsed.expiresAt) {
              parsed.expiresAt = new Date(parsed.expiresAt);
            }
            if (parsed.purchasedAt) {
              parsed.purchasedAt = new Date(parsed.purchasedAt);
            }
            
            // Check if subscription is still active
            if (parsed.expiresAt && new Date() > parsed.expiresAt) {
              // Subscription expired
              parsed.isActive = false;
              parsed.plan = 'free';
            }
            
            setSubscriptionStateInternal(parsed);
          } catch (error) {
            console.error('Failed to parse stored subscription state:', error);
            console.error('Stored subscription value:', stored?.substring(0, 100));
            setSubscriptionStateInternal({ plan: 'free', isActive: false });
          }
        }
        
        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading subscription state:', error);
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const setSubscriptionState = useCallback(async (newState: SubscriptionState) => {
    // Input validation
    if (!newState || typeof newState !== 'object') {
      console.warn('Invalid subscription state provided');
      return;
    }
    
    setSubscriptionStateInternal(newState);
    await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIPTION_STATE, JSON.stringify(newState));
  }, []);

  const getPlanPrice = useCallback((plan: SubscriptionPlan): number => {
    switch (plan) {
      case 'monthly':
        return 12.09;
      case 'annual':
        return 120.90;
      case 'lifetime':
        return 220.00;
      default:
        return 0;
    }
  }, []);

  const purchaseSubscription = useCallback(async (plan: SubscriptionPlan) => {
    // Input validation
    if (!plan || typeof plan !== 'string') {
      console.warn('Invalid subscription plan provided');
      return false;
    }
    
    const validPlans = ['monthly', 'annual', 'lifetime'];
    if (!validPlans.includes(plan)) {
      console.warn('Invalid subscription plan:', plan);
      return false;
    }
    
    console.log(`[Subscription] Purchasing ${plan} plan`);
    
    // In a real app, this would integrate with RevenueCat or similar
    // For now, we'll simulate the purchase
    const now = new Date();
    let expiresAt: Date | undefined;
    
    switch (plan) {
      case 'monthly':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        break;
      case 'annual':
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
        break;
      case 'lifetime':
        // No expiration for lifetime
        expiresAt = undefined;
        break;
      default:
        throw new Error('Invalid subscription plan');
    }

    const newState: SubscriptionState = {
      plan,
      isActive: true,
      expiresAt,
      purchasedAt: now,
    };

    await setSubscriptionState(newState);
    
    // Track purchase
    analytics.track('purchase_succeeded', { 
      plan, 
      price: getPlanPrice(plan),
      currency: 'USD'
    });
    
    console.log(`[Subscription] Successfully purchased ${plan} plan`);
    return true;
  }, [setSubscriptionState, getPlanPrice]);

  const restoreSubscription = useCallback(async () => {
    console.log('[Subscription] Restoring subscription...');
    
    // In a real app, this would check with the app store
    // For now, we'll just return the current state
    analytics.track('restore_purchases');
    return subscriptionState.isActive;
  }, [subscriptionState.isActive]);

  const cancelSubscription = useCallback(async () => {
    console.log('[Subscription] Cancelling subscription...');
    
    const newState: SubscriptionState = {
      plan: 'free',
      isActive: false,
    };

    await setSubscriptionState(newState);
    analytics.trackFeatureUsed('cancel_subscription');
  }, [setSubscriptionState]);

  const getPlanDisplayPrice = useCallback((plan: SubscriptionPlan): string => {
    switch (plan) {
      case 'monthly':
        return '$12.09/month';
      case 'annual':
        return '$120.90/year';
      case 'lifetime':
        return '$220 once';
      default:
        return 'Free';
    }
  }, []);

  const getAnnualSavings = useCallback((): { percentage: number; amount: number } => {
    const monthlyYearly = 12.09 * 12; // $145.08
    const annual = 120.90;
    const savings = monthlyYearly - annual;
    const percentage = Math.round((savings / monthlyYearly) * 100);
    
    return { percentage, amount: savings };
  }, []);

  const isSubscriptionActive = useCallback((): boolean => {
    if (!subscriptionState.isActive) return false;
    
    // Check if subscription has expired
    if (subscriptionState.expiresAt && new Date() > subscriptionState.expiresAt) {
      return false;
    }
    
    return true;
  }, [subscriptionState.isActive, subscriptionState.expiresAt]);

  const canAccessPremiumFeatures = useCallback((): boolean => {
    return isSubscriptionActive();
  }, [isSubscriptionActive]);

  const shouldShowPaywall = useCallback((completedTasksCount: number): boolean => {
    // Don't show paywall until hydrated to prevent flickering
    if (!isHydrated) {
      return false;
    }
    
    // Show paywall after first task is completed and user is not subscribed
    const shouldShow = completedTasksCount >= 1 && !canAccessPremiumFeatures();
    
    // Debug logging for Android
    if (Platform.OS === 'android') {
      console.log('[Android Subscription Debug]', {
        isHydrated,
        completedTasksCount,
        canAccessPremium: canAccessPremiumFeatures(),
        shouldShow,
        subscriptionState: subscriptionState
      });
    }
    
    return shouldShow;
  }, [canAccessPremiumFeatures, isHydrated, subscriptionState]);

  return useMemo(() => ({
    isHydrated,
    subscriptionState,
    purchaseSubscription,
    restoreSubscription,
    cancelSubscription,
    getPlanPrice,
    getPlanDisplayPrice,
    getAnnualSavings,
    isSubscriptionActive,
    canAccessPremiumFeatures,
    shouldShowPaywall,
  }), [
    isHydrated,
    subscriptionState,
    purchaseSubscription,
    restoreSubscription,
    cancelSubscription,
    getPlanPrice,
    getPlanDisplayPrice,
    getAnnualSavings,
    isSubscriptionActive,
    canAccessPremiumFeatures,
    shouldShowPaywall,
  ]);
});