/**
 * Native Google Sign-In for React Native
 * Provides a better UX than browser-based OAuth
 */

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { Platform } from 'react-native';

// IMPORTANT: Replace this with your WEB Client ID from Google Cloud Console
// NOT the Android Client ID - use the Web Client ID!
const WEB_CLIENT_ID = '1005902745773-j47nn1ekvrrpjk2u21cbhe124ngi2922.apps.googleusercontent.com';

/**
 * Configure Google Sign-In
 * Call this once when your app starts
 */
export function configureGoogleSignIn() {
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ['openid', 'profile', 'email'],
    });
    console.log('✅ Google Sign-In configured');
  } catch (error) {
    console.error('❌ Error configuring Google Sign-In:', error);
  }
}

/**
 * Sign in with Google (Native)
 * Shows native Google account picker
 */
export async function signInWithGoogleNative(): Promise<{
  success: boolean;
  error?: Error;
}> {
  try {
    // Check if device has Google Play Services (Android)
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // Show native Google Sign-In picker
    await GoogleSignin.signIn();
    
    // Get the ID token
    const tokens = await GoogleSignin.getTokens();
    
    if (!tokens.idToken) {
      throw new Error('No ID token received from Google');
    }

    console.log('✅ Got Google ID token');

    // Sign in to Supabase with the ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: tokens.idToken,
    });

    if (error) {
      throw error;
    }

    console.log('✅ Signed in with Supabase:', data.user?.email);

    return { success: true };
  } catch (error: any) {
    console.error('❌ Google Sign-In error:', error);
    
    // Handle specific errors
    if (error.code === 'SIGN_IN_CANCELLED') {
      console.log('User cancelled sign-in');
    } else if (error.code === 'IN_PROGRESS') {
      console.log('Sign-in already in progress');
    } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      console.log('Play Services not available');
    }

    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Sign out from Google
 */
export async function signOutFromGoogle() {
  try {
    await GoogleSignin.signOut();
    await supabase.auth.signOut();
    console.log('✅ Signed out from Google');
  } catch (error) {
    console.error('❌ Error signing out:', error);
  }
}

/**
 * Check if user is signed in with Google
 */
export async function isSignedInWithGoogle(): Promise<boolean> {
  try {
    const user = await GoogleSignin.getCurrentUser();
    return user !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get current Google user info
 */
export async function getCurrentGoogleUser() {
  try {
    return await GoogleSignin.getCurrentUser();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

