import { Hono } from 'hono';
import { emailStorageService } from '../../lib/email-storage'

const emailsApi = new Hono();

// Get all emails
emailsApi.get('/', async (c) => {
  try {
    const [emails, stats] = await Promise.all([
      emailStorageService.getAllEmails(),
      emailStorageService.getStats(),
    ]);
    
    return c.json({
      emails,
      stats,
      success: true
    });
  } catch (error) {
    console.error('[Emails API] Failed to get emails:', error);
    return c.json({ 
      error: 'Failed to retrieve emails',
      emails: [],
      stats: {
        total: 0,
        unique: 0,
        signups: 0,
        logins: 0,
        lastUpdated: null
      }
    }, 500);
  }
});

// Export emails
emailsApi.get('/export', async (c) => {
  try {
    const format = c.req.query('format') || 'text';
    
    let content: string;
    if (format === 'csv') {
      content = await emailStorageService.exportEmailsAsCSV();
    } else {
      content = await emailStorageService.exportEmailsAsText();
    }
    
    return c.text(content, 200, {
      'Content-Type': format === 'csv' ? 'text/csv' : 'text/plain',
      'Content-Disposition': `attachment; filename="emails-${new Date().toISOString().split('T')[0]}.${format}"`
    });
  } catch (error) {
    console.error('[Emails API] Failed to export emails:', error);
    return c.json({ error: 'Failed to export emails' }, 500);
  }
});

// Clear emails
emailsApi.delete('/', async (c) => {
  try {
    await emailStorageService.clearEmails();
    
    return c.json({
      success: true,
      message: 'All emails have been cleared'
    });
  } catch (error) {
    console.error('[Emails API] Failed to clear emails:', error);
    return c.json({ error: 'Failed to clear emails' }, 500);
  }
});

export default emailsApi;
