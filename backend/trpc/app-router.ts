import { createTRPCRouter } from "./create-context.js";
import { loginProcedure } from "./routes/auth/login/route.js";
import { signupProcedure } from "./routes/auth/signup/route.js";
import { verifyTokenProcedure } from "./routes/auth/verify/route.js";
import { confirmSupabaseUserProcedure } from "./routes/auth/confirm-supabase-user/route.js";
import { getEmailsProcedure, exportEmailsProcedure, clearEmailsProcedure, getEmailStatsProcedure } from "./routes/admin/emails/route.js";
import { grantPremiumProcedure } from "./routes/admin/users/route.js";
import { createUserProcedure } from "./routes/user/create/route.js";
import { updateUserProcedure } from "./routes/user/update/route.js";
import { getUserProcedure } from "./routes/user/get/route.js";
import { syncUserProcedure } from "./routes/user/sync/route.js";
import { revenueCatWebhookProcedure } from "./routes/webhooks/revenuecat/route.js";

export const appRouter = createTRPCRouter({
  auth: createTRPCRouter({
    login: loginProcedure,
    signup: signupProcedure,
    verifyToken: verifyTokenProcedure,
    confirmSupabaseUser: confirmSupabaseUserProcedure,
  }),
  user: createTRPCRouter({
    create: createUserProcedure,
    update: updateUserProcedure,
    get: getUserProcedure,
    sync: syncUserProcedure,
  }),
  admin: createTRPCRouter({
    emails: createTRPCRouter({
      get: getEmailsProcedure,
      export: exportEmailsProcedure,
      clear: clearEmailsProcedure,
      stats: getEmailStatsProcedure,
    }),
    users: createTRPCRouter({
      grantPremium: grantPremiumProcedure,
    }),
  }),
  webhooks: createTRPCRouter({
    revenuecat: revenueCatWebhookProcedure,
  }),
});

export type AppRouter = typeof appRouter;