import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { analytics } from './analytics';

export interface RevenueCatProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  price_string: string;
  currency_code: string;
  intro_price?: {
    price: number;
    price_string: string;
    period: string;
    cycles: number;
  };
}

export interface RevenueCatOffering {
  identifier: string;
  description: string;
  metadata?: Record<string, any>;
  packages: RevenueCatPackage[];
}

export interface RevenueCatPackage {
  identifier: string;
  package_type: string;
  product: RevenueCatProduct;
  offering_identifier: string;
}

export interface RevenueCatSubscriber {
  original_app_user_id: string;
  original_application_version?: string;
  first_seen: string;
  last_seen: string;
  management_url?: string;
  original_purchase_date?: string;
  other_purchases: Record<string, any>;
  subscriptions: Record<string, RevenueCatSubscription>;
  non_subscriptions: Record<string, any>;
  entitlements: Record<string, RevenueCatEntitlement>;
}

export interface RevenueCatSubscription {
  expires_date?: string;
  purchase_date: string;
  original_purchase_date: string;
  ownership_type: string;
  period_type: string;
  store: string;
  is_sandbox: boolean;
  unsubscribe_detected_at?: string;
  billing_issues_detected_at?: string;
  grace_period_expires_date?: string;
  refunded_at?: string;
  auto_resume_date?: string;
}

export interface RevenueCatEntitlement {
  expires_date?: string;
  purchase_date: string;
  product_identifier: string;
  grace_period_expires_date?: string;
}

export interface RevenueCatPurchaseRequest {
  app_user_id: string;
  fetch_token: string;
  product_id: string;
  price?: number;
  currency?: string;
  is_restore?: boolean;
  presented_offering_identifier?: string;
  observer_mode?: boolean;
  subscriber_attributes?: Record<string, any>;
}

class RevenueCatService {
  private readonly baseUrl = 'https://api.revenuecat.com/v1';
  private readonly publicApiKey: string;
  private readonly secretApiKey: string;
  private appUserId: string | null = null;

  constructor() {
    this.publicApiKey = Constants.expoConfig?.extra?.revenueCatPublicApiKey || 
                      process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_API_KEY || '';
    this.secretApiKey = process.env.REVENUECAT_SECRET_API_KEY || '';
    
    if (!this.publicApiKey) {
      console.warn('[RevenueCat] Public API key not configured');
    }
  }

  private async getAppUserId(): Promise<string> {
    if (this.appUserId) {
      return this.appUserId;
    }

    // Generate a unique user ID based on device info
    let userId: string;
    
    if (Platform.OS === 'ios') {
      userId = await Application.getIosIdForVendorAsync() || 
               `ios_${Math.random().toString(36).substring(2, 15)}`;
    } else if (Platform.OS === 'android') {
      userId = Application.getAndroidId() || 
               `android_${Math.random().toString(36).substring(2, 15)}`;
    } else {
      // Web fallback
      userId = `web_${Math.random().toString(36).substring(2, 15)}`;
    }

    this.appUserId = userId;
    return userId;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    useSecretKey = false
  ): Promise<T> {
    const apiKey = useSecretKey ? this.secretApiKey : this.publicApiKey;
    
    if (!apiKey) {
      throw new Error(`RevenueCat ${useSecretKey ? 'secret' : 'public'} API key not configured`);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Platform': Platform.OS,
        'X-Platform-Version': Platform.Version?.toString() || 'unknown',
        'X-Version': Constants.expoConfig?.version || '1.0.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RevenueCat] API Error ${response.status}:`, errorText);
      throw new Error(`RevenueCat API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getOfferings(): Promise<{ offerings: RevenueCatOffering[]; current_offering_id?: string }> {
    try {
      const appUserId = await this.getAppUserId();
      return await this.makeRequest(`/subscribers/${appUserId}/offerings`);
    } catch (error) {
      console.error('[RevenueCat] Failed to get offerings:', error);
      // Return mock offerings for development
      return {
        offerings: [
          {
            identifier: 'default',
            description: 'Default offering',
            packages: [
              {
                identifier: 'monthly',
                package_type: 'MONTHLY',
                offering_identifier: 'default',
                product: {
                  identifier: 'ambitionly_monthly',
                  title: 'Ambitionly Monthly',
                  description: 'Monthly subscription to Ambitionly Pro',
                  price: 12.09,
                  price_string: '$12.09',
                  currency_code: 'USD',
                },
              },
              {
                identifier: 'annual',
                package_type: 'ANNUAL',
                offering_identifier: 'default',
                product: {
                  identifier: 'ambitionly_annual',
                  title: 'Ambitionly Annual',
                  description: 'Annual subscription to Ambitionly Pro',
                  price: 120.90,
                  price_string: '$120.90',
                  currency_code: 'USD',
                },
              },
              {
                identifier: 'lifetime',
                package_type: 'LIFETIME',
                offering_identifier: 'default',
                product: {
                  identifier: 'ambitionly_lifetime',
                  title: 'Ambitionly Lifetime',
                  description: 'Lifetime access to Ambitionly Pro',
                  price: 220.00,
                  price_string: '$220.00',
                  currency_code: 'USD',
                },
              },
            ],
          },
        ],
        current_offering_id: 'default',
      };
    }
  }

  async getSubscriberInfo(): Promise<RevenueCatSubscriber | null> {
    try {
      const appUserId = await this.getAppUserId();
      const response = await this.makeRequest<{ subscriber: RevenueCatSubscriber }>(
        `/subscribers/${appUserId}`
      );
      return response.subscriber;
    } catch (error) {
      console.error('[RevenueCat] Failed to get subscriber info:', error);
      return null;
    }
  }

  async purchasePackage(
    packageIdentifier: string, 
    productId: string,
    price?: number,
    offeringId?: string
  ): Promise<{ success: boolean; subscriber?: RevenueCatSubscriber; error?: string }> {
    try {
      const appUserId = await this.getAppUserId();
      
      // For development/testing, we'll simulate the purchase
      // In production, this would integrate with the actual store
      if (Platform.OS === 'web' || !this.secretApiKey) {
        console.log(`[RevenueCat] Simulating purchase of ${packageIdentifier}`);
        
        // Simulate successful purchase
        const now = new Date().toISOString();
        let expiresDate: string | undefined;
        
        switch (packageIdentifier) {
          case 'monthly':
            expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'annual':
            expiresDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'lifetime':
            // No expiration for lifetime
            expiresDate = undefined;
            break;
        }

        const mockSubscriber: RevenueCatSubscriber = {
          original_app_user_id: appUserId,
          first_seen: now,
          last_seen: now,
          original_purchase_date: now,
          other_purchases: {},
          subscriptions: {
            [productId]: {
              expires_date: expiresDate,
              purchase_date: now,
              original_purchase_date: now,
              ownership_type: 'PURCHASED',
              period_type: packageIdentifier === 'lifetime' ? 'NORMAL' : 'INTRO',
              store: Platform.OS === 'ios' ? 'APP_STORE' : 'PLAY_STORE',
              is_sandbox: true,
            },
          },
          non_subscriptions: {},
          entitlements: {
            pro: {
              expires_date: expiresDate,
              purchase_date: now,
              product_identifier: productId,
            },
          },
        };

        analytics.track('purchase_succeeded', {
          package_identifier: packageIdentifier,
          product_id: productId,
          price: price || 0,
          simulated: true,
        });

        return { success: true, subscriber: mockSubscriber };
      }

      // Real purchase flow would go here
      const purchaseData: RevenueCatPurchaseRequest = {
        app_user_id: appUserId,
        fetch_token: 'mock_receipt_token', // This would be the actual receipt
        product_id: productId,
        price,
        currency: 'USD',
        presented_offering_identifier: offeringId,
      };

      const response = await this.makeRequest<{ subscriber: RevenueCatSubscriber }>(
        '/receipts',
        {
          method: 'POST',
          body: JSON.stringify(purchaseData),
        },
        true // Use secret key for purchases
      );

      analytics.track('purchase_succeeded', {
        package_identifier: packageIdentifier,
        product_id: productId,
        price: price || 0,
      });

      return { success: true, subscriber: response.subscriber };
    } catch (error) {
      console.error('[RevenueCat] Purchase failed:', error);
      
      analytics.track('purchase_failed', {
        package_identifier: packageIdentifier,
        product_id: productId,
        error: (error as Error).message,
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Purchase failed' 
      };
    }
  }

  async restorePurchases(): Promise<{ success: boolean; subscriber?: RevenueCatSubscriber; error?: string }> {
    try {
      // Get current subscriber info to check for active subscriptions
      const subscriber = await this.getSubscriberInfo();
      
      if (subscriber) {
        // Check if user has any active entitlements
        const hasActiveEntitlements = Object.values(subscriber.entitlements).some(entitlement => {
          if (!entitlement.expires_date) return true; // Lifetime
          return new Date(entitlement.expires_date) > new Date();
        });

        if (hasActiveEntitlements) {
          analytics.track('restore_purchases_succeeded');
          return { success: true, subscriber };
        }
      }

      analytics.track('restore_purchases_failed', { reason: 'No active subscriptions found' });
      return { success: false, error: 'No active subscriptions found' };
    } catch (error) {
      console.error('[RevenueCat] Restore failed:', error);
      
      analytics.track('restore_purchases_failed', {
        error: (error as Error).message,
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Restore failed' 
      };
    }
  }

  async updateSubscriberAttributes(attributes: Record<string, any>): Promise<void> {
    try {
      const appUserId = await this.getAppUserId();
      
      await this.makeRequest(
        `/subscribers/${appUserId}/attributes`,
        {
          method: 'POST',
          body: JSON.stringify({ attributes }),
        }
      );
    } catch (error) {
      console.error('[RevenueCat] Failed to update subscriber attributes:', error);
    }
  }

  isConfigured(): boolean {
    return !!this.publicApiKey;
  }
}

export const revenueCat = new RevenueCatService();
export default revenueCat;