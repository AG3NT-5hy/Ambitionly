import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { db } from '../../../../lib/database';

const updateUserSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  
  // Profile updates
  name: z.string().optional(),
  username: z.string().optional(),
  profilePicture: z.string().optional(),
  
  // Goal and roadmap data
  goal: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  timeCommitment: z.string().nullable().optional(),
  answers: z.string().nullable().optional(), // JSON string
  roadmap: z.string().nullable().optional(), // JSON string
  completedTasks: z.string().nullable().optional(), // JSON string
  streakData: z.string().nullable().optional(), // JSON string
  taskTimers: z.string().nullable().optional(), // JSON string
  
  // Subscription data
  subscriptionPlan: z.string().optional(),
  subscriptionStatus: z.string().nullable().optional(),
  subscriptionExpiresAt: z.string().nullable().optional(),
  subscriptionPurchasedAt: z.string().nullable().optional(),
  revenueCatCustomerInfo: z.string().nullable().optional(),
});

export const updateUserProcedure = protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      // Use userId from input or context
      const userId = input.userId || ctx.user?.id;
      
      if (!userId && !input.email) {
        throw new Error('User ID or email required');
      }
      
      console.log('[User.Update] Updating user:', userId || input.email);
      
      // Build update data
      const updateData: any = {
        lastSyncAt: new Date(),
      };
      
      // Profile updates
      if (input.name !== undefined) updateData.name = input.name;
      if (input.username !== undefined) updateData.username = input.username;
      if (input.profilePicture !== undefined) updateData.profilePicture = input.profilePicture;
      
      // Goal and roadmap data
      if (input.goal !== undefined) updateData.goal = input.goal;
      if (input.timeline !== undefined) updateData.timeline = input.timeline;
      if (input.timeCommitment !== undefined) updateData.timeCommitment = input.timeCommitment;
      if (input.answers !== undefined) updateData.answers = input.answers;
      if (input.roadmap !== undefined) updateData.roadmap = input.roadmap;
      if (input.completedTasks !== undefined) updateData.completedTasks = input.completedTasks;
      if (input.streakData !== undefined) updateData.streakData = input.streakData;
      if (input.taskTimers !== undefined) updateData.taskTimers = input.taskTimers;
      
      // Subscription data
      if (input.subscriptionPlan !== undefined) updateData.subscriptionPlan = input.subscriptionPlan;
      if (input.subscriptionStatus !== undefined) updateData.subscriptionStatus = input.subscriptionStatus;
      if (input.subscriptionExpiresAt !== undefined) {
        updateData.subscriptionExpiresAt = input.subscriptionExpiresAt 
          ? new Date(input.subscriptionExpiresAt) 
          : null;
      }
      if (input.subscriptionPurchasedAt !== undefined) {
        updateData.subscriptionPurchasedAt = input.subscriptionPurchasedAt 
          ? new Date(input.subscriptionPurchasedAt) 
          : null;
      }
      if (input.revenueCatCustomerInfo !== undefined) {
        updateData.revenueCatCustomerInfo = input.revenueCatCustomerInfo;
      }
      
      // Update user
      const user = await db.user.update({
        where: userId ? { id: userId } : { email: input.email },
        data: updateData,
      });
      
      console.log('[User.Update] ✅ User updated:', user.id);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      console.error('[User.Update] Error:', error);
      throw error;
    }
  });

