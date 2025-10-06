import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const storage = Platform.select({
  web: {
    getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
  },
  default: {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, { keychainService: 'ambitionly.supabase' }),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  },
});

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

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
  email: string | null;
  emailVerified: boolean;
};

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  const redirectTo = AuthSession.makeRedirectUri();
  return supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
}

export async function sendPasswordReset(email: string) {
  const redirectTo = AuthSession.makeRedirectUri();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function signInWithGoogle(): Promise<{ error: Error | null }>{
  try {
    const redirectTo = AuthSession.makeRedirectUri();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e: any) {
    console.error('[supabase] Google sign-in error', e);
    return { error: e instanceof Error ? e : new Error('Unknown error') };
  }
}

export async function signInWithApple(): Promise<{ error: Error | null }>{
  try {
    const redirectTo = AuthSession.makeRedirectUri();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo },
    });
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e: any) {
    console.error('[supabase] Apple sign-in error', e);
    return { error: e instanceof Error ? e : new Error('Unknown error') };
  }
}

export async function refreshSessionIfNeeded(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch (e) {
    console.error('[supabase] refreshSessionIfNeeded error', e);
    return null;
  }
}
