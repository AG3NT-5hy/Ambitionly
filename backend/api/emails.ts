import { Hono } from 'hono';

/**
 * Email collection endpoints were removed to simplify the backend setup.
 * These routes now return static responses so downstream clients
 * receive a predictable reply without requiring any storage services.
 */
export const registerEmailRoutes = (app: Hono) => {
  app.get('/api/emails', (c) =>
    c.json({
      success: true,
      message: 'Email collection has been disabled.',
      emails: [],
      stats: {
        total: 0,
        unique: 0,
        signups: 0,
        logins: 0,
        lastUpdated: null,
      },
    })
  );

  app.get('/api/emails/export', (c) =>
    c.json({
      success: true,
      message: 'Email export is currently disabled.',
    })
  );
};

export default registerEmailRoutes;
