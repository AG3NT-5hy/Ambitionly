// Use require() to work around tsx import resolution issues on Render
const honoModule = require("hono");

// Try multiple ways to get the Hono constructor
let Hono: any = null;

// 1. Try named export
if (honoModule.Hono && typeof honoModule.Hono === "function") {
  Hono = honoModule.Hono;
}
// 2. Try default.Hono (nested)
else if (honoModule.default?.Hono && typeof honoModule.default.Hono === "function") {
  Hono = honoModule.default.Hono;
}
// 3. Try default as constructor
else if (honoModule.default && typeof honoModule.default === "function") {
  Hono = honoModule.default;
}
// 4. Try module itself as constructor
else if (typeof honoModule === "function") {
  Hono = honoModule;
}

if (!Hono || typeof Hono !== "function") {
  const moduleKeys = Object.keys(honoModule);
  const defaultKeys = honoModule.default ? Object.keys(honoModule.default) : [];
  throw new Error(
    `[Hono] Failed to load Hono constructor.\n` +
    `Module keys: ${moduleKeys.join(", ")}\n` +
    `Default keys: ${defaultKeys.join(", ")}\n` +
    `Default type: ${typeof honoModule.default}\n` +
    `Module type: ${typeof honoModule}`
  );
}

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