import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '../lib/trpc'
import { useUi } from '../providers/UiProvider'
import { signInWithGoogleNative } from '../lib/google-signin-native';
import { supabase } from '../lib/supabase';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'ambitionly_auth_token',
  USER_EMAIL: 'ambitionly_user_email',
  USER_ID: 'ambitionly_user_id',
};

export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const { showToast } = useUi();
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [shouldShowAuth, setShouldShowAuth] = useState<boolean>(false);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoutHandledRef = useRef<boolean>(false);

  // tRPC hooks
  const signupMutation = trpc.auth.signup.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const verifyTokenQuery = trpc.auth.verifyToken.useQuery(
    { token: authToken || '' },
    { enabled: !!authToken && !isAuthenticated && !authToken?.startsWith('supabase-') }
  );

  // Load auth data from storage on init
  useEffect(() => {
    let isMounted = true;

    const loadAuthData = async () => {
      try {
        const [storedToken, storedEmail, storedUserId] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER_EMAIL),
          AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
        ]);

        if (!isMounted) return;

        if (storedToken && storedEmail && storedUserId) {
          setAuthToken(storedToken);
          setUser({
            id: storedUserId,
            email: storedEmail,
            createdAt: new Date(),
          });
          setIsAuthenticated(true);
        }

        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading auth data:', error);
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    const fallbackTimeout = setTimeout(() => {
      if (isMounted && !isHydrated) {
        console.warn('Auth hydration timeout, marking as hydrated');
        setIsHydrated(true);
      }
    }, 3000);

    loadAuthData();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
    };
  }, [isHydrated]);

  // Sync Supabase session with backend
  const syncSupabaseSession = useCallback(async (supabaseSession: any) => {
    try {
      if (!supabaseSession?.user) return false;

      // Check if user has explicitly signed out by checking if unified user is a guest
      // If unified user store has a guest user, don't restore Supabase session
      try {
        const { STORAGE_KEYS } = await import('../constants');
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          // If unified user is a guest, don't sync Supabase session (user signed out)
          if (userData.isGuest === true) {
            console.log('[AuthStore] Unified user is guest, ignoring Supabase session (user signed out)');
            // Clear Supabase session since user signed out
            await supabase.auth.signOut();
            return false;
          }
        } else {
          // No unified user found, check if auth tokens were cleared (sign out happened)
          const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
          if (!authToken) {
            console.log('[AuthStore] No auth token found, user signed out, ignoring Supabase session');
            // Clear Supabase session since user signed out
            await supabase.auth.signOut();
            return false;
          }
        }
      } catch (checkError) {
        console.warn('[AuthStore] Error checking unified user state:', checkError);
        // If we can't check, be conservative and don't sync
        return false;
      }

      const supabaseUser = supabaseSession.user;
      const email = supabaseUser.email;
      const supabaseId = supabaseUser.id;

      if (!email) {
        console.warn('Supabase user has no email');
        return false;
      }

      // Use Supabase user data directly
      // The backend sync can happen through other means (webhooks, etc.)
      // For now, we authenticate via Supabase
      const token = `supabase-${supabaseId}-${Date.now()}`;
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, supabaseId);

      setAuthToken(token);
      setUser({
        id: supabaseId,
        email,
        createdAt: new Date(supabaseUser.created_at || Date.now()),
      });
      setIsAuthenticated(true);
      setShouldShowAuth(false);

      // Try to sync with backend in background (non-blocking)
      // This will create/update user in backend if needed
      try {
        // We'll handle backend sync through a separate API call later if needed
        // For now, the user is authenticated through Supabase
        console.log('✅ Supabase user authenticated:', email);
      } catch (error) {
        console.warn('Backend sync failed (non-critical):', error);
      }

      return true;
    } catch (error) {
      console.error('Error in syncSupabaseSession:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async (showToastMessage: boolean = true) => {
    // Prevent duplicate logout calls
    if (logoutHandledRef.current) {
      console.log('[AuthStore] Logout already handled, skipping duplicate call');
      return;
    }
    
    try {
      // Mark logout as handled to prevent duplicate calls
      logoutHandledRef.current = true;
      
      // Clear any pending logout timeout since we're actually logging out now
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear local storage
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_EMAIL),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
      ]);

      setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setShouldShowAuth(false);

      // Only show toast if explicitly requested (not during sign-in flow)
      if (showToastMessage) {
        showToast('Logged out successfully', 'success');
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (showToastMessage) {
        showToast('Failed to logout', 'error');
      }
    } finally {
      // Reset the flag after a delay to allow for future sign-outs
      setTimeout(() => {
        logoutHandledRef.current = false;
      }, 2000);
    }
  }, [showToast]);

  // Listen for Supabase auth changes
  useEffect(() => {
    // Get initial session - but check if user signed out first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check if user has signed out before syncing
        try {
          const { STORAGE_KEYS } = await import('../constants');
          const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
          const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
          
          // If unified user is guest or no auth token, user signed out - clear Supabase session
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            if (userData.isGuest === true) {
              console.log('[AuthStore] User is guest, clearing Supabase session on startup');
              await supabase.auth.signOut();
              return;
            }
          } else if (!authToken) {
            console.log('[AuthStore] No auth token found, clearing Supabase session on startup');
            await supabase.auth.signOut();
            return;
          }
        } catch (checkError) {
          console.warn('[AuthStore] Error checking user state on startup:', checkError);
        }
        
        // Only sync if user hasn't signed out
        await syncSupabaseSession(session);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
          // Clear any pending logout timeout since we're signing in
          // This handles the case where SIGNED_OUT fires before SIGNED_IN during Google sign-in
          if (logoutTimeoutRef.current) {
            clearTimeout(logoutTimeoutRef.current);
            logoutTimeoutRef.current = null;
          }
          // Reset logout handled flag when signing in
          logoutHandledRef.current = false;
          await syncSupabaseSession(session);
          showToast('Signed in successfully!', 'success');
        } else if (event === 'SIGNED_OUT') {
          // During sign-in (especially Google), Supabase may emit SIGNED_OUT before SIGNED_IN
          // This is a session switch, not a real logout
          // Delay logout handling to see if SIGNED_IN follows (which will cancel this timeout)
          // Clear any existing timeout first
          if (logoutTimeoutRef.current) {
            clearTimeout(logoutTimeoutRef.current);
          }
          
          // Check if logout was already handled (prevent duplicate toasts)
          if (logoutHandledRef.current) {
            console.log('[AuthStore] SIGNED_OUT event received but logout already handled, ignoring');
            return;
          }
          
          // Set a timeout that will be cancelled if SIGNED_IN follows
          logoutTimeoutRef.current = setTimeout(async () => {
            logoutTimeoutRef.current = null;
            
            // Double-check that we're still signed out (SIGNED_IN might have happened)
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              console.log('[AuthStore] Session exists after SIGNED_OUT timeout - this was a sign-in, not logout, ignoring');
              return;
            }
            
            // Only logout if we're still signed out after delay (user actually logged out)
            // Check again if logout was handled during the delay
            if (!logoutHandledRef.current) {
              // Don't show toast here - UI components (account.tsx, settings.tsx) already show it
              // This prevents duplicate toasts when signOut() triggers multiple SIGNED_OUT events
              logout(false); // Don't show toast - UI components handle it
            }
          }, 2000); // Wait 2 seconds - if SIGNED_IN comes, it will cancel this
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      // Clean up timeout on unmount
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
    };
  }, [syncSupabaseSession, showToast, logout]);

  // Verify token on mount if we have one
  useEffect(() => {
    if (verifyTokenQuery.data && !isAuthenticated) {
      setUser(verifyTokenQuery.data.user);
      setIsAuthenticated(true);
    } else if (verifyTokenQuery.error && authToken) {
      console.error('Token verification failed:', verifyTokenQuery.error);
      logout();
    }
  }, [verifyTokenQuery.data, verifyTokenQuery.error, authToken, isAuthenticated, logout]);

  const signup = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      if (!email || !password) {
        showToast('Email and password are required', 'error');
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address', 'error');
        return false;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return false;
      }

      console.log('[AuthStore] Calling auth.signup mutation with:', {
        emailPreview: email,
        passwordLength: password.length,
      });
      const result = await signupMutation.mutateAsync({ email, password });

      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, result.token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_EMAIL, result.user.email);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, result.user.id);

      setAuthToken(result.token);
      setUser(result.user);
      setIsAuthenticated(true);
      setShouldShowAuth(false);

      showToast('Account created successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create account';
      showToast(message, 'error');
      return false;
    }
  }, [signupMutation, showToast]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      if (!email || !password) {
        showToast('Email and password are required', 'error');
        return false;
      }

      const result = await loginMutation.mutateAsync({ email, password });

      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, result.token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_EMAIL, result.user.email);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, result.user.id);

      setAuthToken(result.token);
      setUser(result.user);
      setIsAuthenticated(true);
      setShouldShowAuth(false);

      showToast('Welcome back!', 'success');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Failed to login';
      showToast(message, 'error');
      return false;
    }
  }, [loginMutation, showToast]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      showToast('Signing in with Google...', 'info');
      
      const { success, error } = await signInWithGoogleNative();
      
      if (!success) {
        // Clear any pending logout timeout
        if (logoutTimeoutRef.current) {
          clearTimeout(logoutTimeoutRef.current);
          logoutTimeoutRef.current = null;
        }
        // Don't show error if user cancelled
        if (error && !error.message?.includes('cancelled') && !error.message?.includes('CANCELLED')) {
          showToast(error.message || 'Failed to sign in with Google', 'error');
        }
        return false;
      }

      // The Supabase auth state change listener will handle the rest
      // It will call syncSupabaseSession automatically
      // The delayed logout timeout will be cancelled when SIGNED_IN event fires
      return true;
    } catch (error) {
      // Clear any pending logout timeout
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
      console.error('Google sign-in error:', error);
      const message = error instanceof Error ? error.message : 'Failed to sign in with Google';
      showToast(message, 'error');
      return false;
    }
  }, [showToast]);

  const triggerAuthFlow = useCallback(() => {
    if (!isAuthenticated) {
      setShouldShowAuth(true);
    }
  }, [isAuthenticated]);

  const dismissAuthFlow = useCallback(() => {
    setShouldShowAuth(false);
  }, []);

  return {
    isHydrated,
    isAuthenticated,
    user,
    authToken,
    shouldShowAuth,
    signup,
    login,
    signInWithGoogle,
    logout,
    triggerAuthFlow,
    dismissAuthFlow,
  };
});
