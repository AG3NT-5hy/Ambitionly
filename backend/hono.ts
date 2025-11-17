// Use CommonJS helper to load Hono (avoids tsx module resolution issues)
const Hono = require("./hono-loader");

import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import registerEmailsApi from "./api/emails";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposeHeaders: ["Content-Length", "Content-Type"],
    maxAge: 600,
    credentials: true,
  })
);

app.onError((err: unknown, c: any) => {
  console.error("[Hono] Error:", err);
  return c.json(
    {
      error: {
        message: err instanceof Error ? err.message : "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      },
    },
    500
  );
});

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

registerEmailsApi(app);

app.get("/", (c: any) => {
  return c.json({ status: "ok", message: "API is running" });
});

app.get("/health", (c: any) => {
  return c.json({
    status: "ok",
    message: "API is running",
    endpoints: {
      trpc: "/api/trpc",
      emails: "/api/emails",
      signup: "/api/trpc/auth.signup (POST)",
    },
  });
});

export default app;