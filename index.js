// Simple Express-like server for deployment
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { trpcServer } = require('@hono/trpc-server');
const { initTRPC } = require('@trpc/server');
const superjson = require('superjson');
const { PrismaClient } = require('@prisma/client');

const app = new Hono();
const prisma = new PrismaClient();

// Enable CORS
app.use('*', cors());

// Simple context
const createContext = async (opts) => {
  return {
    req: opts.req,
    prisma,
  };
};

const t = initTRPC.context().create({
  transformer: superjson,
});

const router = t.router;
const publicProcedure = t.procedure;

// Health check
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Ambitionly Backend API',
    version: '1.0.0'
  });
});

// Simple health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

console.log(`🚀 Server starting on port ${port}`);
console.log(`📍 Health check: http://${host}:${port}/health`);

serve({
  fetch: app.fetch,
  port,
  hostname: host
});

