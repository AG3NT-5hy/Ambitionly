import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { db } from '../../../../../lib/database';

const grantPremiumSchema = z.object({
  email: z.string().email('Invalid email address'),
  plan: z.enum(['monthly', 'annual', 'lifetime'], {
    errorMap: () => ({ message: 'Plan must be monthly, annual, or lifetime' }),
  }),
});

export const grantPremiumProcedure = publicProcedure
  .input(grantPremiumSchema)
  .mutation(async ({ input }) => {
    try {
      console.log(`[Admin] Granting premium access to ${input.email} with plan: ${input.plan}`);
      
      // Find user by email
      const user = await db.user.findUnique({
        where: { email: input.email },
      });
      
      if (!user) {
        throw new Error(`User with email ${input.email} not found`);
      }
      
      // Calculate expiration date based on plan
      const now = new Date();
      let expiresAt: Date | null = null;
      let purchasedAt: Date = now;
      
      switch (input.plan) {
        case 'monthly':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
          break;
        case 'annual':
          expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
          break;
        case 'lifetime':
          expiresAt = null; // No expiration for lifetime
          break;
      }
      
      // Update user subscription
      const updatedUser = await db.user.update({
        where: { email: input.email },
        data: {
          subscriptionPlan: input.plan,
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt,
          subscriptionPurchasedAt: purchasedAt,
          lastSyncAt: now,
        },
      });
      
      console.log(`[Admin] ✅ Premium access granted to ${input.email}:`, {
        plan: input.plan,
        expiresAt: expiresAt?.toISOString() || 'Never (lifetime)',
      });
      
      return {
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          subscriptionPlan: updatedUser.subscriptionPlan,
          subscriptionStatus: updatedUser.subscriptionStatus,
          subscriptionExpiresAt: updatedUser.subscriptionExpiresAt,
        },
        message: `Premium ${input.plan} plan granted successfully`,
      };
    } catch (error) {
      console.error('[Admin] Error granting premium access:', error);
      throw error instanceof Error ? error : new Error('Failed to grant premium access');
    }
  });

