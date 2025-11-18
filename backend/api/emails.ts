import * as HonoModule from 'hono';
import { emailStorageService } from '../../lib/email-storage'

const emailsApi = new HonoModule.Hono();

emailsApi.get('/', async (c) => {
  try {
    const [emails, stats] = await Promise.all([
      emailStorageService.getAllEmails(),
      emailStorageService.getStats(),
    ]);
    return c.json({ emails, stats, success: true });
  } catch (error) {
    console.error('[Emails API] Failed to get emails:', error);
    return c.json({ 
      error: 'Failed to retrieve emails', 
      emails: [], 
      stats: { total: 0, unique: 0, signups: 0, logins: 0, lastUpdated: null } 
    }, 500);
  }
});

emailsApi.get('/export', async (c) => {
  try {
    const format = c.req.query('format') || 'text';
    const content = format === 'csv' 
      ? await emailStorageService.exportEmailsAsCSV() 
      : await emailStorageService.exportEmailsAsText();
    const dateStr = new Date().toISOString().split('T')[0];
    return c.text(content, 200, {
      'Content-Type': format === 'csv' ? 'text/csv' : 'text/plain',
      'Content-Disposition': `attachment; filename="emails-${dateStr}.${format}"`
    });
  } catch (error) {
    console.error('[Emails API] Failed to export emails:', error);
    return c.json({ error: 'Failed to export emails' }, 500);
  }
});

emailsApi.delete('/', async (c) => {
  try {
    await emailStorageService.clearEmails();
    return c.json({ success: true, message: 'All emails have been cleared' });
  } catch (error) {
    console.error('[Emails API] Failed to clear emails:', error);
    return c.json({ error: 'Failed to clear emails' }, 500);
  }
});

export default emailsApi;

