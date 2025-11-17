// Compiled server for production use
require('@swc/register');

const { serve } = require('@hono/node-server');
const app = require('./backend/hono.ts');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

console.log(`🚀 Server is running on port ${port}`);
console.log(`📧 Email API available at: http://localhost:${port}/emails`);
console.log(`🔧 tRPC API available at: http://localhost:${port}/api/trpc`);

serve({
  fetch: app.fetch,
  port,
  hostname: host
});
