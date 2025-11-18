import { emailStorageService } from '../../lib/email-storage';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const honoModule = require('hono');
const Hono = honoModule.Hono || honoModule.default?.Hono || honoModule;

const emailsApi = new Hono();

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
    // Ensure your export logic is here (this was cut off in your screenshot)
    // Example:
    // const csv = await emailStorageService.generateCsv();
    // return c.text(csv);
    return c.json({ message: "Export logic goes here" }); 
  } catch (error) {
    console.error('[Emails API] Failed to export:', error);
    return c.json({ error: 'Failed to export emails' }, 500);
  }
});

export default emailsApi;
