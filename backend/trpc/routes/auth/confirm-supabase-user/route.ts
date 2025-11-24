import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '../../../../lib/supabase';
import { emailStorageService } from '../../../../../lib/email-storage';
import { db } from '../../../../../lib/database';
import * as bcrypt from 'bcryptjs';

const confirmSupabaseUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * This endpoint creates a Supabase user with auto-confirmed email
 * It's used as a fallback when the main signup endpoint is unavailable
 * but we still want to create users without requiring email verification
 */
export const confirmSupabaseUserProcedure = publicProcedure
  .input(confirmSupabaseUserSchema)
  .mutation(async ({ input }) => {
    try {
      console.log('[Auth.ConfirmSupabaseUser] Creating Supabase user with auto-confirmation:', input.email);
      
      // Check if user already exists in database first
      const existingDbUser = await db.user.findUnique({
        where: { email: input.email },
      });
      
      if (existingDbUser) {
        throw new Error('Email already registered');
      }
      
      // Try to create user with auto-confirmed email
      // If user already exists, Supabase will return an error which we'll handle
      const { data: supabaseData, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true, // Auto-confirm email - no verification email sent
      });

      if (supabaseError) {
        // If user already exists, try to get user by email and confirm it
        if (supabaseError.message?.includes('already registered') || 
            supabaseError.message?.includes('already exists') ||
            supabaseError.message?.includes('User already registered')) {
          console.log('[Auth.ConfirmSupabaseUser] User already exists in Supabase, attempting to get and confirm...');
          
          // Try to get user by email (this requires listing users, but it's a fallback)
          try {
            const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            
            if (!listError && usersData?.users) {
              const existingUser = usersData.users.find(u => u.email === input.email);
              if (existingUser) {
                // If email is not confirmed, confirm it
                if (!existingUser.email_confirmed_at) {
                  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    existingUser.id,
                    { email_confirm: true }
                  );
                  
                  if (updateError) {
                    console.error('[Auth.ConfirmSupabaseUser] Error confirming existing user:', updateError);
                  } else {
                    console.log('[Auth.ConfirmSupabaseUser] ✅ Confirmed existing user:', existingUser.id);
                  }
                }
                
                // Check if user exists in database - if not, create a record
                let dbUser = await db.user.findUnique({
                  where: { email: input.email },
                });

                if (!dbUser) {
                  // User exists in Supabase but not in database - create database record
                  console.log('[Auth.ConfirmSupabaseUser] User exists in Supabase but not in database, creating database record...');
                  try {
                    const hashedPassword = await bcrypt.hash(input.password, 10);
                    
                    dbUser = await db.user.create({
                      data: {
                        email: input.email,
                        password: hashedPassword,
                        supabaseId: existingUser.id,
                      },
                    });
                    console.log('[Auth.ConfirmSupabaseUser] ✅ Created database record for existing Supabase user');
                  } catch (createError: any) {
                    console.error('[Auth.ConfirmSupabaseUser] Error creating database record:', createError);
                    // If it's a duplicate key error, try to fetch the user again (race condition)
                    if (createError.code === 'P2002') {
                      dbUser = await db.user.findUnique({
                        where: { email: input.email },
                      });
                    }
                  }
                }
                
                // Collect email for login/signup
                try {
                  if (dbUser) {
                    await emailStorageService.addEmail(input.email, dbUser.id, 'login').catch(error => {
                      console.warn('[Auth.ConfirmSupabaseUser] Failed to store email:', error);
                    });
                  } else {
                    await emailStorageService.addEmail(input.email, existingUser.id, 'login').catch(error => {
                      console.warn('[Auth.ConfirmSupabaseUser] Failed to store email:', error);
                    });
                  }
                } catch (emailError) {
                  console.warn('[Auth.ConfirmSupabaseUser] Email collection failed (non-critical):', emailError);
                }

                return {
                  success: true,
                  supabaseUserId: existingUser.id,
                  wasExisting: true,
                };
              }
            }
          } catch (listErr) {
            console.error('[Auth.ConfirmSupabaseUser] Error listing users:', listErr);
          }
          
          // If we can't find the user, return success anyway (user exists, just can't confirm via API)
          // The user can sign in normally
          throw new Error('User already exists. Please sign in instead.');
        }
        
        console.error('[Auth.ConfirmSupabaseUser] Error creating Supabase user:', supabaseError);
        throw new Error(`Failed to create Supabase user: ${supabaseError.message}`);
      }

      if (!supabaseData.user) {
        throw new Error('Failed to create Supabase user - no user data returned');
      }

      console.log('[Auth.ConfirmSupabaseUser] ✅ Created Supabase user with auto-confirmation:', supabaseData.user.id);

      // Try to find or create user in database and collect email
      try {
        // Try to find user by email
        const dbUser = await db.user.findUnique({
          where: { email: input.email },
        });

        if (dbUser) {
          // User exists in database, collect email for signup
          await emailStorageService.addEmail(input.email, dbUser.id, 'signup').catch(error => {
            console.warn('[Auth.ConfirmSupabaseUser] Failed to store email:', error);
          });
        } else {
          // User doesn't exist in database yet, create a temporary record or use Supabase ID
          // For now, we'll use the Supabase user ID as the userId for email collection
          await emailStorageService.addEmail(input.email, supabaseData.user.id, 'signup').catch(error => {
            console.warn('[Auth.ConfirmSupabaseUser] Failed to store email:', error);
          });
        }
      } catch (emailError) {
        console.warn('[Auth.ConfirmSupabaseUser] Email collection failed (non-critical):', emailError);
      }

      return {
        success: true,
        supabaseUserId: supabaseData.user.id,
        wasExisting: false,
      };
    } catch (error) {
      console.error('[Auth.ConfirmSupabaseUser] Error:', error);
      throw error instanceof Error ? error : new Error('Failed to create/confirm Supabase user');
    }
  });

