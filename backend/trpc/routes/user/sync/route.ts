import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { db } from '../../../../../lib/database';

const syncUserSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email(),
  
  // All user data for full sync
  name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  profilePicture: z.string().nullable().optional(),
  
  // Goal and roadmap data
  goal: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  timeCommitment: z.string().nullable().optional(),
  answers: z.string().nullable().optional(),
  roadmap: z.string().nullable().optional(),
  completedTasks: z.string().nullable().optional(),
  streakData: z.string().nullable().optional(),
  taskTimers: z.string().nullable().optional(),
  
  // Subscription data
  subscriptionPlan: z.string().optional(),
  subscriptionStatus: z.string().nullable().optional(),
  subscriptionExpiresAt: z.string().nullable().optional(),
  subscriptionPurchasedAt: z.string().nullable().optional(),
  
  // Sync metadata
  lastSyncedAt: z.string().optional(),
});

export const syncUserProcedure = protectedProcedure
  .input(syncUserSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      const userId = input.userId || ctx.user?.id;
      
      console.log('[User.Sync] Syncing user:', input.email);
      
      // Check if user exists
      const existingUser = await db.user.findUnique({
        where: { email: input.email },
      });
      
      if (!existingUser) {
        throw new Error('User not found. Please create user first.');
      }
      
      // Update all fields
      const user = await db.user.update({
        where: { email: input.email },
        data: {
          name: input.name,
          username: input.username,
          profilePicture: input.profilePicture,
          
          goal: input.goal,
          timeline: input.timeline,
          timeCommitment: input.timeCommitment,
          answers: input.answers,
          roadmap: input.roadmap,
          completedTasks: input.completedTasks,
          streakData: input.streakData,
          taskTimers: input.taskTimers,
          
          subscriptionPlan: input.subscriptionPlan,
          subscriptionStatus: input.subscriptionStatus,
          subscriptionExpiresAt: input.subscriptionExpiresAt 
            ? new Date(input.subscriptionExpiresAt) 
            : null,
          subscriptionPurchasedAt: input.subscriptionPurchasedAt 
            ? new Date(input.subscriptionPurchasedAt) 
            : null,
          
          lastSyncAt: new Date(),
        },
      });
      
      console.log('[User.Sync] ✅ User synced:', user.id);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          lastSyncAt: user.lastSyncAt,
        },
      };
    } catch (error) {
      console.error('[User.Sync] Error:', error);
      throw error;
    }
  });
