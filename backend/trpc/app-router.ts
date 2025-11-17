import { createTRPCRouter } from "./create-context.js";
import { loginProcedure } from "./routes/auth/login/route.js";
import { signupProcedure } from "./routes/auth/signup/route.js";
import { verifyTokenProcedure } from "./routes/auth/verify/route.js";
import { confirmSupabaseUserProcedure } from "./routes/auth/confirm-supabase-user/route.js";
import { syncDataProcedure, getUserDataProcedure, clearUserDataProcedure } from "./routes/user/sync/route.js";
import { getEmailsProcedure, exportEmailsProcedure, clearEmailsProcedure, getEmailStatsProcedure } from "./routes/admin/emails/route.js";
import { grantPremiumProcedure } from "./routes/admin/users/route.js";
import { userRouter } from "./routes/user/router.js";
import { revenueCatWebhookProcedure } from "./routes/webhooks/revenuecat/route.js";

export const appRouter = createTRPCRouter({
  auth: createTRPCRouter({
    login: loginProcedure,
    signup: signupProcedure,
    verifyToken: verifyTokenProcedure,
    confirmSupabaseUser: confirmSupabaseUserProcedure,
  }),
  user: createTRPCRouter({
    // Legacy endpoints
    sync: syncDataProcedure,
    getData: getUserDataProcedure,
    clearData: clearUserDataProcedure,
    
    // New unified user endpoints
    create: userRouter.create,
    update: userRouter.update,
    get: userRouter.get,
    syncUser: userRouter.sync,
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