import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { prisma } from '../../../../../lib/prisma'
import { supabaseAdmin } from '../../../../lib/supabase'
import { supabaseUserDataService } from '../../../../lib/supabase-user-data'
import { emailStorageService } from '../../../../../lib/email-storage'
import * as crypto from 'crypto';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(userId: string): string {
  const payload = `${userId}-${Date.now()}-${Math.random()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export const signupProcedure = publicProcedure
  .input(SignupSchema)
  .mutation(async ({ input }: { input: z.infer<typeof SignupSchema> }) => {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new Error('Email already registered');
      }

      const hashedPassword = hashPassword(input.password);

      // Create user in Prisma database
      const user = await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
        },
      });

      // Create corresponding user in Supabase
      let supabaseUserId: string | null = null;
      try {
        const { data: supabaseData, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true, // Auto-confirm for now
        });

        if (supabaseError) {
          console.warn('Failed to create Supabase user:', supabaseError);
        } else {
          supabaseUserId = supabaseData.user?.id || null;
          
          // Update Prisma user with Supabase ID
          if (supabaseUserId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseId: supabaseUserId },
            });
          }
        }
      } catch (error) {
        console.warn('Supabase user creation failed:', error);
        // Continue without Supabase user - not critical for signup
      }

      const token = generateToken(user.id);

      // Store email for admin access
      emailStorageService.addEmail(input.email, user.id, 'signup');

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
        supabaseUserId, // Include Supabase user ID in response
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error instanceof Error ? error : new Error('Failed to create account');
    }
  });
