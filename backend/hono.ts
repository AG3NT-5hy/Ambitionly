import HonoModule from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router"
import { createContext } from "./trpc/create-context"
import registerEmailsApi from "./api/emails";

// app will be mounted at /api
const HonoCtor = (HonoModule as any)?.Hono ?? HonoModule;
if (!HonoCtor) {
  throw new Error("Failed to load Hono constructor from 'hono' package");
}
const app = new HonoCtor();

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