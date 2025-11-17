import { z } from 'zod';
import { publicProcedure } from '../../../create-context.js';
import { prisma } from '../../../../../lib/prisma.js';
import { supabaseUserDataService } from '../../../../lib/supabase-user-data.js';
import { emailStorageService } from '../../../../../lib/email-storage.js';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
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

      if (!user.password) {
        throw new Error('Invalid email or password');
      }

      const isValidPassword = await verifyPassword(input.password, user.password);

      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      const token = generateToken(user.id);

      // Store email for admin access (non-blocking)
      emailStorageService.addEmail(input.email, user.id, 'login').catch(error => {
        console.warn('[Login] Failed to store email:', error);
        // Non-critical, continue with login
      });

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
