import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useUi } from '@/providers/UiProvider';

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

  // tRPC hooks
  const signupMutation = trpc.auth.signup.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const verifyTokenQuery = trpc.auth.verifyToken.useQuery(
    { token: authToken || '' },
    { enabled: !!authToken && !isAuthenticated }
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

  const logout = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_EMAIL),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
      ]);

      setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setShouldShowAuth(false);

      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Failed to logout', 'error');
    }
  }, [showToast]);

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
    logout,
    triggerAuthFlow,
    dismissAuthFlow,
  };
});
