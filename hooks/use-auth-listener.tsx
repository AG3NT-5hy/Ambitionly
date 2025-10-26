import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';

/**
 * Hook to listen for authentication state changes
 * Handles OAuth redirects and session management
 */
export function useAuthListener() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      if (session) {
        console.log('✅ User authenticated:', session.user.email);
      }
    });

    // Listen for auth changes (OAuth callbacks, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event);
        
        setSession(session);
        setLoading(false);

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ User signed in:', session?.user?.email);
            // Navigate to main app after successful sign in
            router.replace('/(main)/roadmap');
            break;
            
          case 'SIGNED_OUT':
            console.log('👋 User signed out');
            // Navigate back to welcome/login
            router.replace('/welcome');
            break;
            
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed');
            break;
            
          case 'USER_UPDATED':
            console.log('📝 User updated');
            break;
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    isAuthenticated: !!session,
  };
}

