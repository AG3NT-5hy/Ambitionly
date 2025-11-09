import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router"
import { createContext } from "./trpc/create-context"
import emailsApi from "./api/emails";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors({
  origin: "*", // Allow all origins for now
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
}));

// Mount tRPC router at /api/trpc
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// Mount emails API at /emails
app.route("/emails", emailsApi);

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;