import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { prisma } from '../../../../../lib/prisma'

const VerifyTokenSchema = z.object({
  token: z.string(),
});

function extractUserIdFromToken(token: string): string | null {
  return null;
}

export const verifyTokenProcedure = publicProcedure
  .input(VerifyTokenSchema)
  .query(async ({ input }: { input: z.infer<typeof VerifyTokenSchema> }) => {
    try {
      if (!input.token) {
        throw new Error('Token is required');
      }

      const userId = extractUserIdFromToken(input.token);
      
      if (!userId) {
        throw new Error('Invalid token');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      console.error('Token verification error:', error);
      throw error instanceof Error ? error : new Error('Failed to verify token');
    }
  });
