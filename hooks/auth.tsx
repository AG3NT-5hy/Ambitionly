import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase, signInWithEmail, signUpWithEmail, sendPasswordReset, signOut as sbSignOut, signInWithGoogle, signInWithApple } from '../lib/supabase'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUserProfile {
  id: string;
  email: string | null;
  emailVerified: boolean;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const s = data.session ?? null;
        if (isMounted) {
          if (s?.user) {
            setUser({ id: s.user.id, email: s.user.email ?? null, emailVerified: !!s.user.email_confirmed_at });
            setStatus('authenticated');
          } else {
            setUser(null);
            setStatus('unauthenticated');
          }
        }
      } catch (e) {
        console.error('[Auth] init error', e);
        if (isMounted) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange', event);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null, emailVerified: !!session.user.email_confirmed_at });
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    init();

    return () => {
      sub.subscription.unsubscribe();
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage('Email and password are required.');
      return { error: new Error('Missing credentials') };
    }
    const { error } = await signInWithEmail(email.trim(), password);
    if (error) {
      console.warn('[Auth] signIn error', error.message);
      setErrorMessage(error.message);
      return { error };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage('Email and password are required.');
      return { error: new Error('Missing credentials') };
    }
    const { error } = await signUpWithEmail(email.trim(), password);
    if (error) {
      console.warn('[Auth] signUp error', error.message);
      setErrorMessage(error.message);
      return { error };
    }
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setErrorMessage('');
    if (!email) {
      setErrorMessage('Email is required.');
      return { error: new Error('Missing email') };
    }
    const { error } = await sendPasswordReset(email.trim());
    if (error) {
      console.warn('[Auth] resetPassword error', error.message);
      setErrorMessage(error.message);
      return { error };
    }
    return { error: null };
  }, []);

  const signInGoogle = useCallback(async () => {
    const { error } = await signInWithGoogle();
    if (error) setErrorMessage(error.message);
    return { error };
  }, []);

  const signInApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      return { error: new Error('Apple sign-in is only available on iOS') };
    }
    const { error } = await signInWithApple();
    if (error) setErrorMessage(error.message);
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setErrorMessage('');
    const { error } = await sbSignOut();
    if (error) {
      console.warn('[Auth] signOut error', error.message);
      setErrorMessage(error.message);
      return { error };
    }
    return { error: null };
  }, []);

  return {
    status,
    user,
    errorMessage,
    signIn,
    signUp,
    resetPassword,
    signInGoogle,
    signInApple,
    signOut,
  };
});