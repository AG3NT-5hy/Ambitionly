import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { prisma } from '../../../../../lib/prisma'
import { supabaseAdmin } from '../../../../lib/supabase'
import { supabaseUserDataService } from '../../../../lib/supabase-user-data'
import { emailStorageService } from '../../../../../lib/email-storage'
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function generateToken(userId: string): string {
  const payload = `${userId}-${Date.now()}-${Math.random()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export const signupProcedure = publicProcedure
  .input(SignupSchema)
  .mutation(async ({ input }: { input: z.infer<typeof SignupSchema> }) => {
    try {
      // Check database connection
      try {
        await prisma.$connect();
      } catch (dbError) {
        console.error('[Signup] Database connection error:', dbError);
        throw new Error('Database connection failed. Please check DATABASE_URL environment variable.');
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      }).catch((error) => {
        console.error('[Signup] Database query error:', error);
        throw new Error('Database query failed. Please check database configuration.');
      });

      if (existingUser) {
        throw new Error('Email already registered');
      }

      const hashedPassword = await hashPassword(input.password);

      // Create user in Prisma database
      const user = await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
        },
      }).catch((error) => {
        console.error('[Signup] User creation error:', error);
        // Check for specific Prisma errors
        if (error.code === 'P2002') {
          throw new Error('Email already registered');
        }
        throw new Error('Failed to create user account. Please try again.');
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
          console.warn('[Signup] Failed to create Supabase user:', supabaseError);
          // Check if user already exists in Supabase
          if (supabaseError.message?.includes('already registered') || supabaseError.message?.includes('already exists')) {
            console.log('[Signup] User already exists in Supabase, continuing...');
          }
        } else {
          supabaseUserId = supabaseData.user?.id || null;
          
          // Update Prisma user with Supabase ID
          if (supabaseUserId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseId: supabaseUserId },
            }).catch((error) => {
              console.warn('[Signup] Failed to update user with Supabase ID:', error);
              // Non-critical, continue
            });
          }
        }
      } catch (error) {
        console.warn('[Signup] Supabase user creation failed:', error);
        // Continue without Supabase user - not critical for signup
      }

      const token = generateToken(user.id);

      // Store email for admin access (non-blocking)
      emailStorageService.addEmail(input.email, user.id, 'signup').catch(error => {
        console.warn('[Signup] Failed to store email:', error);
        // Non-critical, continue with signup
      });

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
      console.error('[Signup] Signup error:', error);
      // Ensure we always throw an Error instance with a clear message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create account. Please try again.');
    }
  });
