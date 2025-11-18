import { createTRPCRouter } from '../../create-context';
import { createUserProcedure } from './create/route';
import { updateUserProcedure } from './update/route';
import { getUserProcedure } from './get/route';
import { syncUserProcedure } from './sync/route';

export const userRouter = createTRPCRouter({
  create: createUserProcedure,
  update: updateUserProcedure,
  get: getUserProcedure,
  sync: syncUserProcedure,
});

