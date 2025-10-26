import { createTRPCRouter } from "./create-context";
import { loginProcedure } from "./routes/auth/login/route";
import { signupProcedure } from "./routes/auth/signup/route";
import { verifyTokenProcedure } from "./routes/auth/verify/route";
import { syncDataProcedure, getUserDataProcedure, clearUserDataProcedure } from "./routes/user/sync/route";
import { getEmailsProcedure, exportEmailsProcedure, clearEmailsProcedure, getEmailStatsProcedure } from "./routes/admin/emails/route";
import { userRouter } from "./routes/user/router";
import { revenueCatWebhookProcedure } from "./routes/webhooks/revenuecat/route";

export const appRouter = createTRPCRouter({
  auth: createTRPCRouter({
    login: loginProcedure,
    signup: signupProcedure,
    verifyToken: verifyTokenProcedure,
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
  }),
  webhooks: createTRPCRouter({
    revenuecat: revenueCatWebhookProcedure,
  }),
});

export type AppRouter = typeof appRouter;