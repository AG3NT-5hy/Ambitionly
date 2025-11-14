import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Apple, Chrome, ArrowRight } from 'lucide-react-native';
import { signInWithApple } from '../lib/supabase';
import { signInWithGoogleNative } from '../lib/google-signin-native';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  
  // Local logo asset
  const logoSource = require('../assets/images/logo-main.png');

  useEffect(() => {
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, logoScaleAnim]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log('🔵 Starting native Google Sign-In...');
      
      const { success, error } = await signInWithGoogleNative();
      
      if (!success || error) {
        // Only show alert for actual errors, not user cancellation
        if (error && !error.message?.includes('cancelled')) {
          Alert.alert(
            'Authentication Error',
            error.message || 'Failed to sign in with Google. Please try again.',
            [{ text: 'OK' }]
          );
          console.error('Google sign-in error:', error);
        }
      } else {
        console.log('✅ Google sign-in successful!');
        // Auth listener will handle navigation automatically
      }
    } catch (err) {
      console.error('Unexpected error during Google sign-in:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithApple();
      
      if (error) {
        Alert.alert(
          'Authentication Error',
          error.message || 'Failed to sign in with Apple. Please try again.',
          [{ text: 'OK' }]
        );
        console.error('Apple sign-in error:', error);
      } else {
        // Success - user will be redirected by Supabase OAuth flow
        console.log('Apple sign-in initiated successfully');
      }
    } catch (err) {
      console.error('Unexpected error during Apple sign-in:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow user to continue without authentication (guest mode)
    console.log('User skipped authentication - continuing as guest');
    router.push('/onboarding');
  };

  return (
    <LinearGradient
      colors={['#000000', '#29202B', '#000000']}
      style={styles.container}
    >
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Animated.View 
              style={[
                styles.logoContainer,
                {
                  transform: [{ scale: logoScaleAnim }],
                },
              ]}
            >
              <View style={styles.logoWrapper}>
                <LinearGradient
                  colors={['#29202b', '#8B5CF6', '#A855F7']}
                  style={styles.logoBorder}
                />
                <View style={styles.logoInner}>
                  <Image
                    source={logoSource}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </Animated.View>
            
            <Text style={styles.appName}>Ambitionly</Text>
          </View>

          {/* Quote Section */}
          <View style={styles.quoteSection}>
            <Text style={styles.quoteText}>
              &ldquo;Become the Man capable of{'\n'}Achieving his Ambitions&rdquo;
            </Text>
          </View>

          {/* Login Options */}
          <View style={styles.loginSection}>
            <Text style={styles.loginTitle}>Continue Your Journey</Text>
            <Text style={styles.loginSubtitle}>
              Sign in to sync your progress across devices
            </Text>

            <View style={styles.buttonContainer}>
              {/* Google Login Button */}
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleGoogleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1A1A1A', '#2D2D2D']}
                  style={styles.buttonGradient}
                >
                  <Chrome size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Continue with Google</Text>
                  <ArrowRight size={16} color="#9A9A9A" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Apple Login Button - Only show on iOS */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleAppleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1A1A1A', '#2D2D2D']}
                    style={styles.buttonGradient}
                  >
                    <Apple size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Continue with Apple</Text>
                    <ArrowRight size={16} color="#9A9A9A" />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Skip Button */}
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
                <ArrowRight size={14} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service{'\n'}and Privacy Policy
            </Text>
          </View>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoBorder: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    zIndex: 1,
  },
  logoImage: {
    width: 106,
    height: 106,
    borderRadius: 53,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  quoteSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  quoteText: {
    fontSize: 20,
    color: '#E0E0E0',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 28,
    fontWeight: '500',
  },
  loginSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
  },
  buttonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginLeft: -20, // Compensate for icon space
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
    marginTop: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
});