import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { emailStorageService } from '../../../../../lib/email-storage'

// Admin-only procedure for email management (using publicProcedure for now)
export const getEmailsProcedure = publicProcedure
  .query(async () => {
    try {
      const [emails, stats] = await Promise.all([
        emailStorageService.getAllEmails(),
        emailStorageService.getStats(),
      ]);
      
      console.log(`[Admin Emails] Returning ${emails.length} emails, stats:`, stats);
      
      return {
        emails: emails || [],
        stats: stats || {
          total: 0,
          unique: 0,
          signups: 0,
          logins: 0,
          lastUpdated: null
        },
        success: true
      };
    } catch (error) {
      console.error('[Admin Emails] Failed to get emails:', error);
      // Return empty data instead of throwing to prevent UI errors
      return {
        emails: [],
        stats: {
          total: 0,
          unique: 0,
          signups: 0,
          logins: 0,
          lastUpdated: null
        },
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve emails'
      };
    }
  });

export const exportEmailsProcedure = publicProcedure
  .input(z.object({
    format: z.enum(['text', 'csv']).default('text')
  }))
  .mutation(async ({ input }) => {
    try {
      let content: string;
      
      if (input.format === 'csv') {
        content = await emailStorageService.exportEmailsAsCSV();
      } else {
        content = await emailStorageService.exportEmailsAsText();
      }
      
      return {
        content,
        format: input.format,
        success: true
      };
    } catch (error) {
      console.error('[Admin Emails] Failed to export emails:', error);
      throw new Error('Failed to export emails');
    }
  });

export const clearEmailsProcedure = publicProcedure
  .mutation(async () => {
    try {
      await emailStorageService.clearEmails();
      
      return {
        success: true,
        message: 'All emails have been cleared'
      };
    } catch (error) {
      console.error('[Admin Emails] Failed to clear emails:', error);
      throw new Error('Failed to clear emails');
    }
  });

export const getEmailStatsProcedure = publicProcedure
  .query(async () => {
    try {
      const stats = await emailStorageService.getStats();
      
      return {
        stats,
        success: true
      };
    } catch (error) {
      console.error('[Admin Emails] Failed to get email stats:', error);
      throw new Error('Failed to retrieve email statistics');
    }
  });
