import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { supabaseUserDataService } from '@/lib/supabase-user-data';

// Define the data structure for user sync
const UserDataSchema = z.object({
  goal: z.string().optional(),
  timeline: z.string().optional(),
  timeCommitment: z.string().optional(),
  answers: z.array(z.string()).optional(),
  roadmap: z.any().optional(), // Using any for now, can be more specific later
  completedTasks: z.array(z.string()).optional(),
  streakData: z.object({
    lastCompletionDate: z.string(),
    streak: z.number(),
  }).optional(),
  taskTimers: z.array(z.any()).optional(), // Using any for now
  lastSyncAt: z.string().optional(),
});

export const syncDataProcedure = protectedProcedure
  .input(UserDataSchema)
  .mutation(async ({ input, ctx }: { input: z.infer<typeof UserDataSchema>; ctx: any }) => {
    const userId = ctx.user?.id || 'anonymous';
    
    console.log(`[Cloud Sync] Syncing data for user ${userId}`);
    
    try {
      const result = await supabaseUserDataService.saveUserData(userId, input);
      
      console.log(`[Cloud Sync] Data synced successfully for user ${userId}`);
      
      return result;
    } catch (error) {
      console.error(`[Cloud Sync] Failed to sync data for user ${userId}:`, error);
      throw new Error('Failed to sync user data');
    }
  });

export const getUserDataProcedure = protectedProcedure
  .query(async ({ ctx }: { ctx: any }) => {
    const userId = ctx.user?.id || 'anonymous';
    
    console.log(`[Cloud Sync] Fetching data for user ${userId}`);
    
    try {
      const userData = await supabaseUserDataService.getUserData(userId);
      
      if (!userData) {
        console.log(`[Cloud Sync] No data found for user ${userId}`);
        return null;
      }
      
      console.log(`[Cloud Sync] Data retrieved for user ${userId}`);
      
      return userData;
    } catch (error) {
      console.error(`[Cloud Sync] Failed to fetch data for user ${userId}:`, error);
      throw new Error('Failed to fetch user data');
    }
  });

export const clearUserDataProcedure = protectedProcedure
  .mutation(async ({ ctx }: { ctx: any }) => {
    const userId = ctx.user?.id || 'anonymous';
    
    console.log(`[Cloud Sync] Clearing data for user ${userId}`);
    
    try {
      const result = await supabaseUserDataService.clearUserData(userId);
      
      console.log(`[Cloud Sync] Data cleared for user ${userId}`);
      
      return result;
    } catch (error) {
      console.error(`[Cloud Sync] Failed to clear data for user ${userId}:`, error);
      throw new Error('Failed to clear user data');
    }
  });