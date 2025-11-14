/**
 * Email Storage Service
 * Stores collected emails in the database for admin access
 */

import { db } from './database';

export interface EmailRecord {
  email: string;
  userId: string;
  timestamp: string;
  source: 'signup' | 'login';
}

class EmailStorageService {
  private static instance: EmailStorageService;

  private constructor() {
    // Service is now database-backed, no file system needed
  }

  public static getInstance(): EmailStorageService {
    if (!EmailStorageService.instance) {
      EmailStorageService.instance = new EmailStorageService();
    }
    return EmailStorageService.instance;
  }

  /**
   * Add an email record to the database
   */
  public async addEmail(email: string, userId: string, source: 'signup' | 'login'): Promise<void> {
    try {
      // Check if email already exists for this user
      const existingRecord = await db.emailRecord.findFirst({
        where: {
          email: email,
          userId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingRecord) {
        // Update existing record with new timestamp and source
        await db.emailRecord.update({
          where: { id: existingRecord.id },
          data: {
            source: source,
            createdAt: new Date(), // Update timestamp
          },
        });
        console.log(`[EmailStorage] Updated email record: ${email} (User: ${userId}, Source: ${source})`);
      } else {
        // Create new email record
        await db.emailRecord.create({
          data: {
            email: email,
            userId: userId,
            source: source,
          },
        });
        console.log(`[EmailStorage] Added email record: ${email} (User: ${userId}, Source: ${source})`);
      }
    } catch (error) {
      console.error('[EmailStorage] Failed to add email:', error);
      // Don't throw - email collection is non-critical
    }
  }

  /**
   * Get all email records from the database
   */
  public async getAllEmails(): Promise<EmailRecord[]> {
    try {
      const records = await db.emailRecord.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      return records.map(record => ({
        email: record.email,
        userId: record.userId,
        timestamp: record.createdAt.toISOString(),
        source: record.source as 'signup' | 'login',
      }));
    } catch (error) {
      console.error('[EmailStorage] Failed to get all emails:', error);
      return [];
    }
  }

  /**
   * Get emails by source
   */
  public async getEmailsBySource(source: 'signup' | 'login'): Promise<EmailRecord[]> {
    try {
      const records = await db.emailRecord.findMany({
        where: {
          source: source,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return records.map(record => ({
        email: record.email,
        userId: record.userId,
        timestamp: record.createdAt.toISOString(),
        source: record.source as 'signup' | 'login',
      }));
    } catch (error) {
      console.error('[EmailStorage] Failed to get emails by source:', error);
      return [];
    }
  }

  /**
   * Get total email count
   */
  public async getEmailCount(): Promise<number> {
    try {
      return await db.emailRecord.count();
    } catch (error) {
      console.error('[EmailStorage] Failed to get email count:', error);
      return 0;
    }
  }

  /**
   * Get unique email count
   */
  public async getUniqueEmailCount(): Promise<number> {
    try {
      const uniqueEmails = await db.emailRecord.findMany({
        select: {
          email: true,
        },
        distinct: ['email'],
      });
      return uniqueEmails.length;
    } catch (error) {
      console.error('[EmailStorage] Failed to get unique email count:', error);
      return 0;
    }
  }

  /**
   * Export emails as text
   */
  public async exportEmailsAsText(): Promise<string> {
    try {
      const emails = await this.getAllEmails();
      const total = emails.length;
      const unique = await this.getUniqueEmailCount();

      const emailList = emails
        .map(email => `${email.email} (${email.source}) - ${email.timestamp}`)
        .join('\n');

      return `Collected Emails (${total} total, ${unique} unique)\n` +
             `Generated: ${new Date().toISOString()}\n\n` +
             emailList;
    } catch (error) {
      console.error('[EmailStorage] Failed to export emails as text:', error);
      return '';
    }
  }

  /**
   * Export emails as CSV
   */
  public async exportEmailsAsCSV(): Promise<string> {
    try {
      const emails = await this.getAllEmails();
      const headers = 'Email,User ID,Source,Timestamp';
      const rows = emails
        .map(email => `"${email.email}","${email.userId}","${email.source}","${email.timestamp}"`)
        .join('\n');

      return headers + '\n' + rows;
    } catch (error) {
      console.error('[EmailStorage] Failed to export emails as CSV:', error);
      return '';
    }
  }

  /**
   * Clear all email records
   */
  public async clearEmails(): Promise<void> {
    try {
      await db.emailRecord.deleteMany({});
      console.log('[EmailStorage] All email records cleared');
    } catch (error) {
      console.error('[EmailStorage] Failed to clear emails:', error);
      throw error;
    }
  }

  /**
   * Get email statistics
   */
  public async getStats(): Promise<{
    total: number;
    unique: number;
    signups: number;
    logins: number;
    lastUpdated: string | null;
  }> {
    try {
      const [total, unique, signups, logins, lastRecord] = await Promise.all([
        this.getEmailCount(),
        this.getUniqueEmailCount(),
        db.emailRecord.count({ where: { source: 'signup' } }),
        db.emailRecord.count({ where: { source: 'login' } }),
        db.emailRecord.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      return {
        total,
        unique,
        signups,
        logins,
        lastUpdated: lastRecord?.createdAt.toISOString() || null,
      };
    } catch (error) {
      console.error('[EmailStorage] Failed to get stats:', error);
      return {
        total: 0,
        unique: 0,
        signups: 0,
        logins: 0,
        lastUpdated: null,
      };
    }
  }
}

export const emailStorageService = EmailStorageService.getInstance();
