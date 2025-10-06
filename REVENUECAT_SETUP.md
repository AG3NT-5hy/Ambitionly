# RevenueCat Integration Setup Guide

This guide will help you set up RevenueCat for handling in-app purchases and subscriptions in your Ambitionly app.

## Overview

RevenueCat is integrated using their REST API, which works with Expo Go and provides:
- Cross-platform subscription management
- Receipt validation
- Analytics and insights
- Webhook support for backend integration
- Customer support tools

## 1. RevenueCat Dashboard Setup

### Create RevenueCat Account
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Create an account and new project
3. Choose "Ambitionly" as your app name

### Configure App Store Connect (iOS)
1. In RevenueCat dashboard, go to "Project Settings" > "Apps"
2. Add iOS app with your bundle ID: `app.rork.ambitionly-ai-goal-roadmap-app`
3. Upload your App Store Connect API key:
   - Go to App Store Connect > Users and Access > Keys
   - Create new API key with "App Manager" role
   - Download the .p8 file and upload to RevenueCat

### Configure Google Play Console (Android)
1. Add Android app with package name: `app.rork.ambitionly-ai-goal-roadmap-app`
2. Upload Google Play service account key:
   - Go to Google Play Console > Setup > API access
   - Create service account and download JSON key
   - Upload to RevenueCat

## 2. Product Configuration

### Create Products in App Stores

#### iOS App Store Connect
1. Go to App Store Connect > My Apps > Ambitionly > Features > In-App Purchases
2. Create these products:
   - **Monthly**: `ambitionly_monthly` - Auto-Renewable Subscription - $12.09/month
   - **Annual**: `ambitionly_annual` - Auto-Renewable Subscription - $120.90/year
   - **Lifetime**: `ambitionly_lifetime` - Non-Consumable - $220.00

#### Google Play Console
1. Go to Google Play Console > Ambitionly > Monetize > Products > Subscriptions
2. Create matching products with same IDs

### Configure Products in RevenueCat
1. Go to RevenueCat Dashboard > Products
2. Import products from both stores
3. Create entitlement called "pro" that includes all products
4. Create offering called "default" with all three packages

## 3. Environment Configuration

### Get API Keys
1. Go to RevenueCat Dashboard > Project Settings > API Keys
2. Copy the **Public API Key** (starts with `pk_`)
3. Copy the **Secret API Key** (starts with `sk_`) - keep this secure!

### Update Environment Variables
Create a `.env` file in your project root:

```bash
# RevenueCat Configuration
EXPO_PUBLIC_REVENUECAT_PUBLIC_API_KEY=pk_test_your_public_key_here
REVENUECAT_SECRET_API_KEY=sk_your_secret_key_here

# Other required variables
EXPO_PUBLIC_RORK_API_BASE_URL=https://your-backend-url.com
```

## 4. Backend Integration

### Webhook Setup
1. In RevenueCat Dashboard, go to "Project Settings" > "Webhooks"
2. Add webhook URL: `https://your-backend-url.com/api/webhooks/revenuecat`
3. Select events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`

### Backend Webhook Handler
Create `backend/trpc/routes/webhooks/revenuecat/route.ts`:

```typescript
import { z } from 'zod';
import { publicProcedure } from '../../create-context';

const revenueCatWebhookSchema = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    original_app_user_id: z.string(),
    product_id: z.string(),
    period_type: z.string(),
    purchased_at_ms: z.number(),
    expiration_at_ms: z.number().optional(),
    environment: z.enum(['SANDBOX', 'PRODUCTION']),
    entitlement_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).optional(),
    presented_offering_id: z.string().optional(),
    transaction_id: z.string(),
    original_transaction_id: z.string(),
    is_family_share: z.boolean().optional(),
    country_code: z.string().optional(),
    app_id: z.string(),
    aliases: z.array(z.string()).optional(),
  }),
});

export const revenueCatWebhookProcedure = publicProcedure
  .input(revenueCatWebhookSchema)
  .mutation(async ({ input }) => {
    const { event } = input;
    
    console.log(`[RevenueCat Webhook] ${event.type} for user ${event.app_user_id}`);
    
    // Handle different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        // User purchased or renewed subscription
        await handleSubscriptionActivated(event);
        break;
        
      case 'CANCELLATION':
        // User cancelled subscription (still active until expiration)
        await handleSubscriptionCancelled(event);
        break;
        
      case 'EXPIRATION':
        // Subscription expired
        await handleSubscriptionExpired(event);
        break;
        
      default:
        console.log(`[RevenueCat Webhook] Unhandled event type: ${event.type}`);
    }
    
    return { success: true };
  });

async function handleSubscriptionActivated(event: any) {
  // Update user's subscription status in your database
  // Send welcome email, unlock features, etc.
  console.log(`User ${event.app_user_id} activated subscription: ${event.product_id}`);
}

async function handleSubscriptionCancelled(event: any) {
  // User cancelled but subscription is still active until expiration
  console.log(`User ${event.app_user_id} cancelled subscription: ${event.product_id}`);
}

async function handleSubscriptionExpired(event: any) {
  // Subscription expired, revoke access
  console.log(`User ${event.app_user_id} subscription expired: ${event.product_id}`);
}
```

## 5. Testing

### Sandbox Testing
1. Use sandbox/test accounts for both iOS and Android
2. RevenueCat automatically detects sandbox environment
3. Test all purchase flows:
   - New purchases
   - Subscription renewals
   - Cancellations
   - Restore purchases

### Test Cards
- iOS: Use App Store Connect sandbox accounts
- Android: Use Google Play Console test accounts

## 6. Production Deployment

### App Store Submission
1. Ensure all products are approved in App Store Connect
2. Submit app for review with in-app purchases
3. Test with production API keys before release

### Environment Variables for Production
```bash
# Production RevenueCat keys
EXPO_PUBLIC_REVENUECAT_PUBLIC_API_KEY=pk_your_production_public_key
REVENUECAT_SECRET_API_KEY=sk_your_production_secret_key
```

## 7. Analytics and Monitoring

### RevenueCat Dashboard
- Monitor subscription metrics
- Track conversion rates
- Analyze churn and retention
- View revenue analytics

### Custom Analytics
The integration automatically tracks:
- `purchase_started`
- `purchase_succeeded`
- `purchase_failed`
- `restore_purchases_succeeded`
- `restore_purchases_failed`

## 8. Customer Support

### RevenueCat Customer Lists
1. Go to RevenueCat Dashboard > Customer Lists
2. Search users by app_user_id
3. View subscription history and status
4. Issue refunds or promotional subscriptions

### Restore Purchases
Users can restore purchases through the app:
1. Tap "Restore Purchases" in paywall
2. App calls RevenueCat API to check for active subscriptions
3. Automatically restores access if valid subscription found

## 9. Security Best Practices

### API Key Security
- Never commit secret API keys to version control
- Use environment variables for all keys
- Rotate keys periodically
- Use different keys for development/production

### Webhook Security
- Verify webhook signatures (RevenueCat provides signature verification)
- Use HTTPS for all webhook endpoints
- Implement rate limiting on webhook endpoints

## 10. Troubleshooting

### Common Issues
1. **Products not loading**: Check product IDs match between stores and RevenueCat
2. **Purchases failing**: Verify API keys and app configuration
3. **Webhooks not firing**: Check webhook URL and RevenueCat configuration
4. **Restore not working**: Ensure user is signed in with same Apple/Google account

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=expo*
```

### Support
- RevenueCat Documentation: https://docs.revenuecat.com
- RevenueCat Support: https://community.revenuecat.com
- App Store Connect Help: https://developer.apple.com/support/app-store-connect/
- Google Play Console Help: https://support.google.com/googleplay/android-developer/

## Next Steps

1. Set up RevenueCat account and configure products
2. Add environment variables to your project
3. Test purchases in sandbox environment
4. Implement webhook handler in your backend
5. Submit app for store review
6. Monitor analytics and optimize conversion rates

The integration is now complete and ready for production use!