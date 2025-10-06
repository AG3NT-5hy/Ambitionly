import * as fs from 'fs';
import * as path from 'path';

interface EmailRecord {
  email: string;
  userId: string;
  timestamp: string;
  source: 'signup' | 'login';
}

class EmailStorageService {
  private static instance: EmailStorageService;
  private emailsFile: string;
  private emails: EmailRecord[] = [];

  private constructor() {
    // Store emails in a secure server-side location
    this.emailsFile = path.join(process.cwd(), 'data', 'collected-emails.json');
    this.ensureDataDirectory();
    this.loadEmails();
  }

  public static getInstance(): EmailStorageService {
    if (!EmailStorageService.instance) {
      EmailStorageService.instance = new EmailStorageService();
    }
    return EmailStorageService.instance;
  }

  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.emailsFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadEmails(): void {
    try {
      if (fs.existsSync(this.emailsFile)) {
        const data = fs.readFileSync(this.emailsFile, 'utf8');
        this.emails = JSON.parse(data);
      } else {
        this.emails = [];
        this.saveEmails();
      }
    } catch (error) {
      console.error('[EmailStorage] Failed to load emails:', error);
      this.emails = [];
    }
  }

  private saveEmails(): void {
    try {
      fs.writeFileSync(this.emailsFile, JSON.stringify(this.emails, null, 2));
    } catch (error) {
      console.error('[EmailStorage] Failed to save emails:', error);
    }
  }

  public addEmail(email: string, userId: string, source: 'signup' | 'login'): void {
    // Check if email already exists
    const existingEmail = this.emails.find(e => e.email === email);
    
    if (existingEmail) {
      // Update existing record with new timestamp and source
      existingEmail.timestamp = new Date().toISOString();
      existingEmail.source = source;
      existingEmail.userId = userId;
    } else {
      // Add new email record
      const emailRecord: EmailRecord = {
        email,
        userId,
        timestamp: new Date().toISOString(),
        source
      };
      this.emails.push(emailRecord);
    }
    
    this.saveEmails();
    console.log(`[EmailStorage] Email ${source}: ${email} (User: ${userId})`);
  }

  public getAllEmails(): EmailRecord[] {
    return [...this.emails]; // Return a copy to prevent external modification
  }

  public getEmailsBySource(source: 'signup' | 'login'): EmailRecord[] {
    return this.emails.filter(email => email.source === source);
  }

  public getEmailCount(): number {
    return this.emails.length;
  }

  public getUniqueEmailCount(): number {
    const uniqueEmails = new Set(this.emails.map(e => e.email));
    return uniqueEmails.size;
  }

  public exportEmailsAsText(): string {
    const emails = this.emails
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map(email => `${email.email} (${email.source}) - ${email.timestamp}`)
      .join('\n');
    
    return `Collected Emails (${this.getEmailCount()} total, ${this.getUniqueEmailCount()} unique)\n` +
           `Generated: ${new Date().toISOString()}\n\n` +
           emails;
  }

  public exportEmailsAsCSV(): string {
    const headers = 'Email,User ID,Source,Timestamp';
    const rows = this.emails
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map(email => `"${email.email}","${email.userId}","${email.source}","${email.timestamp}"`)
      .join('\n');
    
    return headers + '\n' + rows;
  }

  public clearEmails(): void {
    this.emails = [];
    this.saveEmails();
    console.log('[EmailStorage] All emails cleared');
  }

  public getStats(): {
    total: number;
    unique: number;
    signups: number;
    logins: number;
    lastUpdated: string | null;
  } {
    const signups = this.getEmailsBySource('signup').length;
    const logins = this.getEmailsBySource('login').length;
    const lastEmail = this.emails.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    return {
      total: this.getEmailCount(),
      unique: this.getUniqueEmailCount(),
      signups,
      logins,
      lastUpdated: lastEmail?.timestamp || null
    };
  }
}

export const emailStorageService = EmailStorageService.getInstance();
