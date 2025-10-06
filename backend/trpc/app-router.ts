import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { loginProcedure } from "./routes/auth/login/route";
import { signupProcedure } from "./routes/auth/signup/route";
import { syncDataProcedure, getUserDataProcedure, clearUserDataProcedure } from "./routes/user/sync/route";
import { getEmailsProcedure, exportEmailsProcedure, clearEmailsProcedure, getEmailStatsProcedure } from "./routes/admin/emails/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: createTRPCRouter({
    login: loginProcedure,
    signup: signupProcedure,
  }),
  user: createTRPCRouter({
    sync: syncDataProcedure,
    getData: getUserDataProcedure,
    clearData: clearUserDataProcedure,
  }),
  admin: createTRPCRouter({
    emails: createTRPCRouter({
      get: getEmailsProcedure,
      export: exportEmailsProcedure,
      clear: clearEmailsProcedure,
      stats: getEmailStatsProcedure,
    }),
  }),
});

export type AppRouter = typeof appRouter;