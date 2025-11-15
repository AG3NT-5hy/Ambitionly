import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router"
import { createContext } from "./trpc/create-context"
import registerEmailsApi from "./api/emails";

// Import Hono using namespace import for better tsx compatibility
import * as HonoNamespace from "hono";
// Extract Hono class - try named export first, then default
const Hono = (HonoNamespace as any).Hono || (HonoNamespace as any).default || HonoNamespace;

// app will be mounted at /api
if (!Hono || typeof Hono !== 'function') {
  console.error('[Hono] Namespace keys:', Object.keys(HonoNamespace));
  throw new Error(`Failed to load Hono constructor. Type: ${typeof Hono}, Namespace keys: ${Object.keys(HonoNamespace).join(', ')}`);
}
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors({
  origin: "*", // Allow all origins for now
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposeHeaders: ["Content-Length", "Content-Type"],
  maxAge: 600,
  credentials: true,
}));

// Add error handling middleware
app.onError((err: Error, c: any) => {
  console.error('[Hono] Error:', err);
  return c.json(
    {
      error: {
        message: err.message || 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
    500
  );
});

// Mount tRPC router at /api/trpc
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`[tRPC] Error on path "${path}":`, error);
    },
  })
);

// Mount emails API routes
registerEmailsApi(app);

// Simple health check endpoint
app.get("/", (c: any) => {
  return c.json({ status: "ok", message: "API is running" });
});

// Health check for tRPC
app.get("/health", (c: any) => {
  return c.json({ 
    status: "ok", 
    message: "API is running",
    endpoints: {
      trpc: "/api/trpc",
      emails: "/api/emails",
      signup: "/api/trpc/auth.signup (POST)"
    }
  });
});

export default app;