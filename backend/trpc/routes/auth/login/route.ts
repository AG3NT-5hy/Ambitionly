import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { prisma } from '../../../../../lib/prisma'
import { supabaseUserDataService } from '../../../../lib/supabase-user-data'
import { emailStorageService } from '../../../../../lib/email-storage'
import * as crypto from 'crypto';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(userId: string): string {
  const payload = `${userId}-${Date.now()}-${Math.random()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export const loginProcedure = publicProcedure
  .input(LoginSchema)
  .mutation(async ({ input }: { input: z.infer<typeof LoginSchema> }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      const hashedPassword = hashPassword(input.password);

      if (user.password !== hashedPassword) {
        throw new Error('Invalid email or password');
      }

      const token = generateToken(user.id);

      // Store email for admin access
      emailStorageService.addEmail(input.email, user.id, 'login');

      // Load user data from Supabase
      let userData = null;
      try {
        userData = await supabaseUserDataService.getUserData(user.id);
      } catch (error) {
        console.warn('Failed to load user data from Supabase:', error);
        // Continue without user data - it's not critical for login
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
        userData, // Include user data in login response
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error instanceof Error ? error : new Error('Failed to login');
    }
  });
