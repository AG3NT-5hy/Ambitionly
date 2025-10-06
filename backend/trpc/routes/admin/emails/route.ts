import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { emailStorageService } from '@/lib/email-storage';

// Admin-only procedure for email management (using publicProcedure for now)
export const getEmailsProcedure = publicProcedure
  .query(async () => {
    try {
      const emails = emailStorageService.getAllEmails();
      const stats = emailStorageService.getStats();
      
      return {
        emails,
        stats,
        success: true
      };
    } catch (error) {
      console.error('[Admin Emails] Failed to get emails:', error);
      throw new Error('Failed to retrieve emails');
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
        content = emailStorageService.exportEmailsAsCSV();
      } else {
        content = emailStorageService.exportEmailsAsText();
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
      emailStorageService.clearEmails();
      
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
      const stats = emailStorageService.getStats();
      
      return {
        stats,
        success: true
      };
    } catch (error) {
      console.error('[Admin Emails] Failed to get email stats:', error);
      throw new Error('Failed to retrieve email statistics');
    }
  });
