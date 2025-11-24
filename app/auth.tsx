import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useUnifiedUser } from '../lib/unified-user-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, user, isHydrated } = useUnifiedUser();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  // Start in login mode if 'mode=signin' query param is present, or if coming from welcome screen
  const [isLogin, setIsLogin] = useState<boolean>(params.mode === 'signin' || params.from === 'welcome');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSubmit = async () => {
    if (isLoading) return;

    setError('');
    
    // Validate inputs
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[Auth] Sign in/up timeout - taking too long');
      setIsLoading(false);
      setError('Request timed out. Please try again.');
    }, 30000); // 30 second timeout
    
    try {
      let result;
      if (isLogin) {
        // Use unified user store signIn which restores data from database
        console.log('[Auth] Starting sign in...');
        result = await signIn(email.trim(), password);
        console.log('[Auth] Sign in result:', result);
      } else {
        // Use unified user store signUp
        console.log('[Auth] Starting sign up...');
        result = await signUp(email.trim(), password, email.trim().split('@')[0] || 'User');
        console.log('[Auth] Sign up result:', result);
      }

      clearTimeout(timeoutId);

      // Check if sign in/up was successful - either through result or Supabase session
      let signInSuccessful = result?.success === true;
      
      // If result doesn't indicate success, check Supabase session as fallback
      if (!signInSuccessful) {
        try {
          const { supabase } = await import('../lib/supabase');
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            console.log('[Auth] Supabase session exists, sign in was successful');
            signInSuccessful = true;
          }
        } catch (e) {
          console.warn('[Auth] Error checking Supabase session:', e);
        }
      }

      if (signInSuccessful) {
        console.log('[Auth] Sign in/up successful, waiting for user data to be saved...');
        
        // Wait for unified user store to save user data to AsyncStorage
        // Check AsyncStorage directly since React state updates are async
        let userSaved = false;
        for (let attempt = 0; attempt < 15; attempt++) {
          const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              if (userData && !userData.isGuest) {
                console.log(`[Auth] User data saved and verified on attempt ${attempt + 1}`);
                userSaved = true;
                break;
              }
            } catch (e) {
              // Continue checking
            }
          }
          
          if (attempt < 14) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (!userSaved) {
          console.warn('[Auth] User data not saved after sign in/up, but continuing anyway');
          // Check Supabase session as fallback
          try {
            const { supabase } = await import('../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              console.log('[Auth] Supabase session exists, user is signed in');
              userSaved = true;
            }
          } catch (e) {
            console.warn('[Auth] Error checking Supabase session:', e);
          }
        }
        
        // Wait for data restoration (reduced time)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if user has roadmap (with timeout)
        let storedGoal: string | null = null;
        let storedRoadmap: string | null = null;
        let hasRoadmap = false;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          storedGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL);
          storedRoadmap = await AsyncStorage.getItem(STORAGE_KEYS.ROADMAP);
          hasRoadmap = !!(storedGoal && storedRoadmap);
          
          if (hasRoadmap) {
            console.log(`[Auth] Roadmap found on attempt ${attempt + 1}`);
            break;
          }
          
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        console.log('[Auth] Final check:', {
          hasGoal: !!storedGoal,
          hasRoadmap: !!storedRoadmap,
          userSaved,
        });
        
        // Always navigate - don't wait forever
        setIsLoading(false);
        
        // Navigate directly to the appropriate screen based on data
        if (hasRoadmap) {
          // User has roadmap - go to roadmap
          console.log('[Auth] Navigating to roadmap (has roadmap)');
          router.replace('/(main)/roadmap');
        } else {
          // User doesn't have roadmap - go to welcome
          console.log('[Auth] Navigating to welcome (no roadmap)');
          router.replace('/welcome?noRoadmap=true');
        }
      } else {
        clearTimeout(timeoutId);
        setIsLoading(false);
        setError(isLogin ? 'Invalid email or password' : 'Failed to create account. Please try again.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      setIsLoading(false);
      let errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      
      console.error('[Auth] Sign in/up error:', err);
      
      // Handle JSON parse errors first
      if (errorMessage.includes('JSON Parse error') || 
          errorMessage.includes('Unexpected character') ||
          errorMessage.includes('invalid JSON') ||
          errorMessage.includes('non-JSON') ||
          errorMessage.includes('Unable to connect to the server') ||
          errorMessage.includes('Server returned non-JSON') ||
          errorMessage.includes('Server returned invalid JSON') ||
          errorMessage.includes('Backend is running') ||
          errorMessage.includes('API URL')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (errorMessage.includes('Network request failed') || 
                 errorMessage.includes('fetch') ||
                 errorMessage.includes('network') ||
                 errorMessage.includes('ECONNREFUSED') ||
                 errorMessage.includes('ERR_NETWORK') ||
                 errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      // Check if it's an "already registered" error and automatically switch to sign-in
      // But only if it's not a JSON parse or network error
      if (!errorMessage.includes('Unable to connect') && 
          !errorMessage.includes('Network error') &&
          (errorMessage.includes('already registered') || errorMessage.includes('Email already') || errorMessage.includes('already exists'))) {
        // Switch to sign-in mode automatically
        setIsLogin(true);
        setError('This email is already registered. We\'ve switched you to sign in. Please enter your password to continue.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle) return;

    setError('');
    setIsLoadingGoogle(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[Auth] Google sign-in timeout - taking too long');
      setIsLoadingGoogle(false);
      setError('Request timed out. Please try again.');
    }, 30000); // 30 second timeout
    
    try {
      const success = await signInWithGoogle();
      clearTimeout(timeoutId);
      
      if (success) {
        // Wait for unified user store to save user data to AsyncStorage
        // Check AsyncStorage directly since React state updates are async
        let userSaved = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              if (userData && !userData.isGuest) {
                console.log(`[Auth] User data saved and verified on attempt ${attempt + 1} (Google)`);
                userSaved = true;
                break;
              }
            } catch (e) {
              // Continue checking
            }
          }
          
          if (attempt < 9) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        if (!userSaved) {
          console.warn('[Auth] User data not saved after Google sign in, but continuing anyway');
        }
        
        // Wait longer for data to be restored from server and ambition store to reload
        // restoreServerDataToLocal writes to AsyncStorage, then triggers reload with 300ms delay
        // We need to wait for both the write and the reload to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Check if user has roadmap
        let storedGoal: string | null = null;
        let storedRoadmap: string | null = null;
        let hasRoadmap = false;
        
        for (let attempt = 0; attempt < 5; attempt++) {
          storedGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL);
          storedRoadmap = await AsyncStorage.getItem(STORAGE_KEYS.ROADMAP);
          hasRoadmap = !!(storedGoal && storedRoadmap);
          
          if (hasRoadmap) {
            console.log(`[Auth] Roadmap found on attempt ${attempt + 1} (Google)`);
            break;
          }
          
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Navigate directly to the appropriate screen based on data
        if (hasRoadmap) {
          console.log('[Auth] Navigating to roadmap (Google - has roadmap)');
          router.replace('/(main)/roadmap');
        } else {
          console.log('[Auth] Navigating to welcome (Google - no roadmap)');
          router.replace('/welcome?noRoadmap=true');
        }
      } else {
        clearTimeout(timeoutId);
        setIsLoadingGoogle(false);
        setError('Failed to sign in with Google. Please try again.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to sign in with Google. Please try again.';
      
      if (err instanceof Error) {
        const msg = err.message || '';
        
        // Provide user-friendly error messages
        if (msg.includes('JSON Parse error') || 
            msg.includes('Unexpected character') ||
            msg.includes('invalid JSON') ||
            msg.includes('non-JSON') ||
            msg.includes('Unable to connect to the server') ||
            msg.includes('Backend is running') ||
            msg.includes('Server returned non-JSON') ||
            msg.includes('Server returned invalid JSON')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (msg.includes('Network request failed') || 
                   msg.includes('fetch') ||
                   msg.includes('network') ||
                   msg.includes('ECONNREFUSED') ||
                   msg.includes('ERR_NETWORK') ||
                   msg.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (msg.includes('cancel') || msg.includes('cancelled') || msg.includes('SIGN_IN_CANCELLED')) {
          // User cancelled - don't show error, just return
          setIsLoadingGoogle(false);
          return;
        } else if (msg.includes('already registered') || msg.includes('Email already') || msg.includes('already exists')) {
          // User already exists - switch to sign-in mode
          setIsLogin(true);
          errorMessage = 'This email is already registered. We\'ve switched you to sign in. Please use your password to continue.';
        } else if (msg.includes('Request timed out')) {
          errorMessage = 'Request timed out. Please check your internet connection and try again.';
        } else if (msg) {
          // Use the error message if it's already user-friendly
          errorMessage = msg;
        }
      }
      
      console.error('[Auth] Google sign-in error:', err);
      setError(errorMessage);
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const toggleMode = () => {
    // Prevent toggling if coming from welcome screen (sign in only)
    if (params.from === 'welcome') {
      return;
    }
    setError('');
    setIsLogin(!isLogin);
  };

  return (
    <LinearGradient colors={['#000000', '#29202B', '#000000']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>
                {isLogin ? 'Welcome Back!' : 'Create Your Account'}
              </Text>
              <Text style={styles.subtitle}>
                {isLogin 
                  ? 'Sign in to access your roadmaps from any device'
                  : 'Save your progress and access your roadmaps from anywhere'}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Mail size={20} color="#9A9A9A" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#666666"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading && !isLoadingGoogle}
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color="#9A9A9A" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#666666"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading && !isLoadingGoogle}
                  autoComplete={isLogin ? 'password' : 'password-new'}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#9A9A9A" />
                  ) : (
                    <Eye size={20} color="#9A9A9A" />
                  )}
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  {error.includes('already registered') && isLogin && (
                    <Text style={styles.errorHint}>
                      Your email has been preserved. Just enter your password above to sign in.
                    </Text>
                  )}
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, (isLoading || isLoadingGoogle) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading || isLoadingGoogle}
              >
                <LinearGradient
                  colors={(isLoading || isLoadingGoogle) ? ['#333333', '#333333'] : ['#29202b', '#8B5CF6', '#7C3AED']}
                  style={styles.submitButtonGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign In Button */}
              <TouchableOpacity
                style={[styles.googleButton, (isLoading || isLoadingGoogle) && styles.googleButtonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={isLoading || isLoadingGoogle}
              >
                {isLoadingGoogle ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <View style={styles.googleIcon}>
                      <Text style={styles.googleIconText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>
                      {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Hide toggle if coming from welcome screen (sign in only) */}
              {params.from !== 'welcome' && (
                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  </Text>
                  <TouchableOpacity onPress={toggleMode} disabled={isLoading || isLoadingGoogle}>
                    <Text style={styles.switchLink}>
                      {isLogin ? 'Sign Up' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.benefits}>
              <Text style={styles.benefitsTitle}>Why create an account?</Text>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>☁️</Text>
                <Text style={styles.benefitText}>Access your roadmaps from any device</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>🔒</Text>
                <Text style={styles.benefitText}>Secure cloud backup of your progress</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>📊</Text>
                <Text style={styles.benefitText}>Track your journey across devices</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 20,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  form: {
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  errorContainer: {
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  errorHint: {
    color: '#B0A8FF',
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2D2D2D',
  },
  dividerText: {
    color: '#666666',
    fontSize: 14,
    marginHorizontal: 16,
    fontWeight: '600' as const,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
    minHeight: 56,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  switchText: {
    fontSize: 14,
    color: '#9A9A9A',
  },
  switchLink: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600' as const,
  },
  benefits: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitText: {
    fontSize: 14,
    color: '#B3B3B3',
    flex: 1,
  },
});
