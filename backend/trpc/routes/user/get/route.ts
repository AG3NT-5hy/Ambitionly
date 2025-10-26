import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { db } from '../../../../lib/database';

const getUserSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  supabaseId: z.string().optional(),
});

export const getUserProcedure = protectedProcedure
  .input(getUserSchema)
  .query(async ({ input, ctx }) => {
    try {
      const userId = input.userId || ctx.user?.id;
      
      if (!userId && !input.email && !input.supabaseId) {
        throw new Error('User identifier required');
      }
      
      console.log('[User.Get] Fetching user:', userId || input.email || input.supabaseId);
      
      // Build where clause
      let where: any = {};
      if (userId) {
        where.id = userId;
      } else if (input.email) {
        where.email = input.email;
      } else if (input.supabaseId) {
        where.supabaseId = input.supabaseId;
      }
      
      const user = await db.user.findUnique({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          profilePicture: true,
          supabaseId: true,
          revenueCatUserId: true,
          isGuest: true,
          createdAt: true,
          updatedAt: true,
          lastSyncAt: true,
          
          // Goal and roadmap data
          goal: true,
          timeline: true,
          timeCommitment: true,
          answers: true,
          roadmap: true,
          completedTasks: true,
          streakData: true,
          taskTimers: true,
          
          // Subscription data
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          subscriptionPurchasedAt: true,
          revenueCatCustomerInfo: true,
        },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      console.log('[User.Get] ✅ User found:', user.id);
      
      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error('[User.Get] Error:', error);
      throw error;
    }
  });

