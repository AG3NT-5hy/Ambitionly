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
  const { signIn, signUp, signInWithGoogle } = useUnifiedUser();
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
    try {
      let result;
      if (isLogin) {
        // Use unified user store signIn which restores data from database
        result = await signIn(email.trim(), password);
      } else {
        // Use unified user store signUp
        result = await signUp(email.trim(), password, email.trim().split('@')[0] || 'User');
      }

      if (result?.success) {
        // Wait longer for data to be restored from server and ambition store to reload
        // restoreServerDataToLocal writes to AsyncStorage, then triggers reload with 300ms delay
        // We need to wait for both the write and the reload to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if user has roadmap and premium status
        // Try multiple times with retries in case data is still loading
        let storedGoal: string | null = null;
        let storedRoadmap: string | null = null;
        let hasRoadmap = false;
        
        for (let attempt = 0; attempt < 5; attempt++) {
          storedGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL);
          storedRoadmap = await AsyncStorage.getItem(STORAGE_KEYS.ROADMAP);
          hasRoadmap = !!(storedGoal && storedRoadmap);
          
          if (hasRoadmap) {
            console.log(`[Auth] Roadmap found on attempt ${attempt + 1}`);
            break;
          }
          
          if (attempt < 4) {
            console.log(`[Auth] Roadmap not found on attempt ${attempt + 1}, waiting and retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        console.log('[Auth] Final check:', {
          hasGoal: !!storedGoal,
          hasRoadmap: !!storedRoadmap,
          goalLength: storedGoal?.length || 0,
          roadmapLength: storedRoadmap?.length || 0,
        });
        
        // Check if user is premium (handle lifetime plans)
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        let isPremium = false;
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            const isLifetime = userData.subscriptionPlan === 'lifetime';
            const hasValidExpiration = !userData.subscriptionExpiresAt || new Date(userData.subscriptionExpiresAt) > new Date();
            isPremium = userData.subscriptionPlan && 
                       userData.subscriptionPlan !== 'free' &&
                       userData.subscriptionStatus === 'active' &&
                       (isLifetime || hasValidExpiration);
            console.log('[Auth] Premium check:', {
              plan: userData.subscriptionPlan,
              status: userData.subscriptionStatus,
              expiresAt: userData.subscriptionExpiresAt,
              isLifetime,
              isPremium,
            });
          } catch (e) {
            console.warn('[Auth] Failed to parse user data:', e);
          }
        }
        
        if (hasRoadmap) {
          // User has roadmap - go to roadmap (premium not required to view local roadmap)
          console.log('[Auth] Navigating to roadmap (has roadmap)');
          router.replace('/(main)/roadmap');
        } else {
          // User doesn't have roadmap - go to welcome with message
          console.log('[Auth] Navigating to welcome (no roadmap)');
          router.replace('/welcome?noRoadmap=true');
        }
      } else {
        setError(isLogin ? 'Invalid email or password' : 'Failed to create account. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      
      // Check if it's an "already registered" error and automatically switch to sign-in
      if (errorMessage.includes('already registered') || errorMessage.includes('Email already') || errorMessage.includes('already exists')) {
        // Switch to sign-in mode automatically
        setIsLogin(true);
        setError('This email is already registered. We\'ve switched you to sign in. Please enter your password to continue.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle) return;

    setError('');
    setIsLoadingGoogle(true);
    
    try {
      const success = await signInWithGoogle();
      
      if (success) {
        // Wait longer for data to be restored from server and ambition store to reload
        // restoreServerDataToLocal writes to AsyncStorage, then triggers reload with 300ms delay
        // We need to wait for both the write and the reload to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if user has roadmap and premium status
        // Try multiple times with retries in case data is still loading
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
            console.log(`[Auth] Roadmap not found on attempt ${attempt + 1}, waiting and retrying... (Google)`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        console.log('[Auth] Final check (Google):', {
          hasGoal: !!storedGoal,
          hasRoadmap: !!storedRoadmap,
          goalLength: storedGoal?.length || 0,
          roadmapLength: storedRoadmap?.length || 0,
        });
        
        // Check if user is premium (handle lifetime plans)
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        let isPremium = false;
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            const isLifetime = userData.subscriptionPlan === 'lifetime';
            const hasValidExpiration = !userData.subscriptionExpiresAt || new Date(userData.subscriptionExpiresAt) > new Date();
            isPremium = userData.subscriptionPlan && 
                       userData.subscriptionPlan !== 'free' &&
                       userData.subscriptionStatus === 'active' &&
                       (isLifetime || hasValidExpiration);
            console.log('[Auth] Premium check (Google):', {
              plan: userData.subscriptionPlan,
              status: userData.subscriptionStatus,
              expiresAt: userData.subscriptionExpiresAt,
              isLifetime,
              isPremium,
            });
          } catch (e) {
            console.warn('[Auth] Failed to parse user data:', e);
          }
        }
        
        if (hasRoadmap) {
          // User has roadmap - go to roadmap (premium not required to view local roadmap)
          console.log('[Auth] Navigating to roadmap (Google - has roadmap)');
          router.replace('/(main)/roadmap');
        } else {
          // User doesn't have roadmap - go to welcome with message
          console.log('[Auth] Navigating to welcome (Google - no roadmap)');
          router.replace('/welcome?noRoadmap=true');
        }
      } else {
        setError('Failed to sign in with Google. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in with Google. Please try again.';
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
