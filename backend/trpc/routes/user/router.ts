import { createTRPCRouter } from '../../create-context.js';
import { createUserProcedure } from './create/route.js';
import { updateUserProcedure } from './update/route.js';
import { getUserProcedure } from './get/route.js';
import { syncUserProcedure } from './sync/route.js';

export const userRouter = createTRPCRouter({
  create: createUserProcedure,
  update: updateUserProcedure,
  get: getUserProcedure,
  sync: syncUserProcedure,
});

