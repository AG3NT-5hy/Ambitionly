import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

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
  
  // Example: Update user in database
  // await db.user.update({
  //   where: { revenueCatUserId: event.app_user_id },
  //   data: {
  //     subscriptionStatus: 'active',
  //     subscriptionPlan: event.product_id.replace('ambitionly_', ''),
  //     subscriptionExpiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
  //     subscriptionPurchasedAt: new Date(event.purchased_at_ms),
  //   },
  // });
}

async function handleSubscriptionCancelled(event: any) {
  // User cancelled but subscription is still active until expiration
  console.log(`User ${event.app_user_id} cancelled subscription: ${event.product_id}`);
  
  // Example: Mark as cancelled but keep active until expiration
  // await db.user.update({
  //   where: { revenueCatUserId: event.app_user_id },
  //   data: {
  //     subscriptionStatus: 'cancelled',
  //     subscriptionCancelledAt: new Date(),
  //   },
  // });
}

async function handleSubscriptionExpired(event: any) {
  // Subscription expired, revoke access
  console.log(`User ${event.app_user_id} subscription expired: ${event.product_id}`);
  
  // Example: Revoke premium access
  // await db.user.update({
  //   where: { revenueCatUserId: event.app_user_id },
  //   data: {
  //     subscriptionStatus: 'expired',
  //     subscriptionPlan: 'free',
  //     subscriptionExpiresAt: null,
  //   },
  // });
}