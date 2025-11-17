// Use require() to work around tsx import resolution issues on Render
const honoModule = require("hono");

// Try multiple ways to get the Hono constructor
let Hono: any = null;

// Access default via bracket notation in case it's a getter
const defaultExport = honoModule["default"] || honoModule.default;

// 1. Try named export
if (honoModule.Hono && typeof honoModule.Hono === "function") {
  Hono = honoModule.Hono;
}
// 2. Try default.Hono (nested)
else if (defaultExport?.Hono && typeof defaultExport.Hono === "function") {
  Hono = defaultExport.Hono;
}
// 3. Try default as constructor
else if (defaultExport && typeof defaultExport === "function") {
  Hono = defaultExport;
}
// 4. Try module itself as constructor
else if (typeof honoModule === "function") {
  Hono = honoModule;
}
// 5. Try accessing via property descriptor (for getters)
else {
  try {
    const desc = Object.getOwnPropertyDescriptor(honoModule, "default");
    if (desc?.value && typeof desc.value === "function") {
      Hono = desc.value;
    } else if (desc?.get) {
      const getterValue = desc.get();
      if (getterValue && typeof getterValue === "function") {
        Hono = getterValue;
      } else if (getterValue?.Hono && typeof getterValue.Hono === "function") {
        Hono = getterValue.Hono;
      }
    }
  } catch (e) {
    // Ignore errors from property descriptor access
  }
}

if (!Hono || typeof Hono !== "function") {
  const moduleKeys = Object.keys(honoModule);
  const defaultKeys = defaultExport ? Object.keys(defaultExport) : [];
  const desc = Object.getOwnPropertyDescriptor(honoModule, "default");
  throw new Error(
    `[Hono] Failed to load Hono constructor.\n` +
    `Module keys: ${moduleKeys.join(", ")}\n` +
    `Default keys: ${defaultKeys.join(", ")}\n` +
    `Default type: ${typeof defaultExport}\n` +
    `Default via bracket: ${typeof honoModule["default"]}\n` +
    `Property descriptor: ${desc ? JSON.stringify({ value: typeof desc.value, get: !!desc.get, set: !!desc.set }) : "none"}\n` +
    `Module type: ${typeof honoModule}`
  );
}

import { emailStorageService } from '../../lib/email-storage';

export const registerEmailsApi = (app: any) => {
  const route = new Hono();

  // Get all emails
  route.get('/', async (c) => {
    try {
      const [emails, stats] = await Promise.all([
        emailStorageService.getAllEmails(),
        emailStorageService.getStats(),
      ]);

      return c.json({
        emails,
        stats,
        success: true,
      });
    } catch (error) {
      console.error('[Emails API] Failed to get emails:', error);
      return c.json(
        {
          error: 'Failed to retrieve emails',
          emails: [],
          stats: {
            total: 0,
            unique: 0,
            signups: 0,
            logins: 0,
            lastUpdated: null,
          },
        },
        500
      );
    }
  });

  // Export emails
  route.get('/export', async (c) => {
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
        'Content-Disposition': `attachment; filename="emails-${new Date().toISOString().split('T')[0]}.${format}"`,
      });
    } catch (error) {
      console.error('[Emails API] Failed to export emails:', error);
      return c.json({ error: 'Failed to export emails' }, 500);
    }
  });

  // Clear emails
  route.delete('/', async (c) => {
    try {
      await emailStorageService.clearEmails();

      return c.json({
        success: true,
        message: 'All emails have been cleared',
      });
    } catch (error) {
      console.error('[Emails API] Failed to clear emails:', error);
      return c.json({ error: 'Failed to clear emails' }, 500);
    }
  });

  app.route('/api/emails', route);
};

export default registerEmailsApi;
