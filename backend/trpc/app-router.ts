import { createTRPCRouter } from "./create-context";
import { loginProcedure } from "./routes/auth/login/route";
import { signupProcedure } from "./routes/auth/signup/route";
import { verifyTokenProcedure } from "./routes/auth/verify/route";
import { confirmSupabaseUserProcedure } from "./routes/auth/confirm-supabase-user/route";
import { getEmailsProcedure, exportEmailsProcedure, clearEmailsProcedure, getEmailStatsProcedure } from "./routes/admin/emails/route";
import { grantPremiumProcedure } from "./routes/admin/users/route";
import { createUserProcedure } from "./routes/user/create/route";
import { updateUserProcedure } from "./routes/user/update/route";
import { getUserProcedure } from "./routes/user/get/route";
import { syncUserProcedure } from "./routes/user/sync/route";
import { revenueCatWebhookProcedure } from "./routes/webhooks/revenuecat/route";

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