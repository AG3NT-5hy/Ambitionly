import { z } from 'zod';
import { protectedProcedure } from '../../../create-context.js';
import { db } from '../../../../../lib/database.js';
import { emailStorageService } from '../../../../../lib/email-storage.js';
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
      console.log('[User.Create] Creating/updating user:', input.email);
      
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: input.email },
      });
      
      // Hash password if provided
      let hashedPassword = null;
      if (input.password) {
        hashedPassword = await bcrypt.hash(input.password, 10);
      }
      
      // Prepare data for create/update
      const userData: any = {
        email: input.email,
        lastSyncAt: new Date(),
      };
      
      // Only set password if provided and user doesn't exist (don't overwrite existing password)
      if (hashedPassword && !existingUser) {
        userData.password = hashedPassword;
      }
      
      // Set optional fields if provided
      if (input.name !== undefined) userData.name = input.name;
      if (input.username !== undefined) userData.username = input.username;
      if (input.profilePicture !== undefined) userData.profilePicture = input.profilePicture;
      if (input.supabaseId !== undefined) userData.supabaseId = input.supabaseId;
      if (input.revenueCatUserId !== undefined) userData.revenueCatUserId = input.revenueCatUserId || input.email;
      if (input.deviceId !== undefined) userData.deviceId = input.deviceId;
      if (input.isGuest !== undefined) userData.isGuest = input.isGuest;
      
      // Guest data migration - only update if provided
      if (input.guestData) {
        if (input.guestData.goal !== undefined) userData.goal = input.guestData.goal;
        if (input.guestData.timeline !== undefined) userData.timeline = input.guestData.timeline;
        if (input.guestData.timeCommitment !== undefined) userData.timeCommitment = input.guestData.timeCommitment;
        if (input.guestData.answers !== undefined) userData.answers = input.guestData.answers;
        if (input.guestData.roadmap !== undefined) userData.roadmap = input.guestData.roadmap;
        if (input.guestData.completedTasks !== undefined) userData.completedTasks = input.guestData.completedTasks;
        if (input.guestData.streakData !== undefined) userData.streakData = input.guestData.streakData;
        if (input.guestData.taskTimers !== undefined) userData.taskTimers = input.guestData.taskTimers;
        
        // Subscription data
        if (input.guestData.subscriptionPlan !== undefined) {
          userData.subscriptionPlan = input.guestData.subscriptionPlan || 'free';
        }
        if (input.guestData.subscriptionStatus !== undefined) {
          userData.subscriptionStatus = input.guestData.subscriptionStatus || 'inactive';
        }
        if (input.guestData.subscriptionExpiresAt !== undefined) {
          userData.subscriptionExpiresAt = input.guestData.subscriptionExpiresAt 
            ? new Date(input.guestData.subscriptionExpiresAt) 
            : null;
        }
        if (input.guestData.subscriptionPurchasedAt !== undefined) {
          userData.subscriptionPurchasedAt = input.guestData.subscriptionPurchasedAt 
            ? new Date(input.guestData.subscriptionPurchasedAt) 
            : null;
        }
      }
      
      // Use upsert: create if doesn't exist, update if exists
      const wasNewUser = !existingUser;
      const user = await db.user.upsert({
        where: { email: input.email },
        update: userData,
        create: {
          ...userData,
          // Ensure required fields for creation
          password: hashedPassword || null,
          subscriptionPlan: input.guestData?.subscriptionPlan || 'free',
          subscriptionStatus: input.guestData?.subscriptionStatus || 'inactive',
        },
      });
      
      console.log('[User.Create] ✅ User created/updated:', user.id);
      
      // Collect email for new users (signup) - non-blocking
      // This handles cases where users are created via createUser route (e.g., Supabase fallback)
      if (wasNewUser && !input.isGuest) {
        emailStorageService.addEmail(input.email, user.id, 'signup').catch(error => {
          console.warn('[User.Create] Failed to store email:', error);
          // Non-critical, continue with user creation
        });
      }
      
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

