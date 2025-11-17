import Hono from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { emailStorageService } from "../lib/email-storage";

export const registerEmailsApi = (app: Hono) => {
  const route = new Hono();

  route.get("/", async (c) => {
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
      console.error("[Emails API] Failed to get emails:", error);
      return c.json(
        {
          error: "Failed to retrieve emails",
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

  route.get("/export", async (c) => {
    try {
      const format = c.req.query("format") || "text";

      let content: string;
      if (format === "csv") {
        content = await emailStorageService.exportEmailsAsCSV();
      } else {
        content = await emailStorageService.exportEmailsAsText();
      }

      return c.text(content, 200, {
        "Content-Type": format === "csv" ? "text/csv" : "text/plain",
        "Content-Disposition": `attachment; filename="emails-${
          new Date().toISOString().split("T")[0]
        }.${format}"`,
      });
    } catch (error) {
      console.error("[Emails API] Failed to export emails:", error);
      return c.json({ error: "Failed to export emails" }, 500);
    }
  });

  route.delete("/", async (c) => {
    try {
      await emailStorageService.clearEmails();

      return c.json({
        success: true,
        message: "All emails have been cleared",
      });
    } catch (error) {
      console.error("[Emails API] Failed to clear emails:", error);
      return c.json({ error: "Failed to clear emails" }, 500);
    }
  });

  app.route("/api/emails", route);
};

export const createApp = () => {
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

  app.onError((err, c) => {
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

  app.get("/", (c) => {
    return c.json({ status: "ok", message: "API is running" });
  });

  app.get("/health", (c) => {
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

  return app;
};

export default createApp();