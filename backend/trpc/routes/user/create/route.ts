import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { db } from '../../../../lib/database';
import * as bcrypt from 'bcryptjs';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  name: z.string().optional(),
  username: z.string().optional(),
  profilePicture: z.string().optional(),
  
  // Guest data migration
  guestData: z.object({
    goal: z.string().nullable().optional(),
    timeline: z.string().nullable().optional(),
    timeCommitment: z.string().nullable().optional(),
    answers: z.string().nullable().optional(), // JSON string
    roadmap: z.string().nullable().optional(), // JSON string
    completedTasks: z.string().nullable().optional(), // JSON string
    streakData: z.string().nullable().optional(), // JSON string
    taskTimers: z.string().nullable().optional(), // JSON string
    subscriptionPlan: z.string().optional(),
    subscriptionStatus: z.string().nullable().optional(),
    subscriptionExpiresAt: z.string().nullable().optional(),
    subscriptionPurchasedAt: z.string().nullable().optional(),
  }).optional(),
  
  // Integration IDs
  supabaseId: z.string().optional(),
  revenueCatUserId: z.string().optional(),
  deviceId: z.string().optional(),
  isGuest: z.boolean().default(false),
});

export const createUserProcedure = protectedProcedure
  .input(createUserSchema)
  .mutation(async ({ input }) => {
    try {
      console.log('[User.Create] Creating user:', input.email);
      
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: input.email },
      });
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Hash password if provided
      let hashedPassword = null;
      if (input.password) {
        hashedPassword = await bcrypt.hash(input.password, 10);
      }
      
      // Create user with all data
      const user = await db.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
          username: input.username,
          profilePicture: input.profilePicture,
          supabaseId: input.supabaseId,
          revenueCatUserId: input.revenueCatUserId || input.email,
          deviceId: input.deviceId,
          isGuest: input.isGuest,
          
          // Guest data migration
          goal: input.guestData?.goal,
          timeline: input.guestData?.timeline,
          timeCommitment: input.guestData?.timeCommitment,
          answers: input.guestData?.answers,
          roadmap: input.guestData?.roadmap,
          completedTasks: input.guestData?.completedTasks,
          streakData: input.guestData?.streakData,
          taskTimers: input.guestData?.taskTimers,
          
          // Subscription data
          subscriptionPlan: input.guestData?.subscriptionPlan || 'free',
          subscriptionStatus: input.guestData?.subscriptionStatus || 'inactive',
          subscriptionExpiresAt: input.guestData?.subscriptionExpiresAt 
            ? new Date(input.guestData.subscriptionExpiresAt) 
            : null,
          subscriptionPurchasedAt: input.guestData?.subscriptionPurchasedAt 
            ? new Date(input.guestData.subscriptionPurchasedAt) 
            : null,
          
          lastSyncAt: new Date(),
        },
      });
      
      console.log('[User.Create] ✅ User created:', user.id);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      console.error('[User.Create] Error:', error);
      throw error;
    }
  });

