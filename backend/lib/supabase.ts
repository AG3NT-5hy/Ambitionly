/**
 * Backend-only Supabase client
 * This version doesn't import React Native dependencies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// Server-side Supabase client without React Native storage
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Admin client for server-side operations (uses service role key if available)
export const supabaseAdmin: SupabaseClient = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : supabase; // Fallback to regular client if service role key not available

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    return token;
  } catch (e) {
    console.error('[supabase] getSupabaseAccessToken error', e);
    return null;
  }
}

export type AuthUser = {
  id: string;
  email: string;
  [key: string]: any;
};

export async function signInWithEmail(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return await supabase.auth.signUp({ email, password });
}

export async function sendPasswordReset(email: string) {
  return await supabase.auth.resetPasswordForEmail(email);
}

export async function signOut() {
  return await supabase.auth.signOut();
}

