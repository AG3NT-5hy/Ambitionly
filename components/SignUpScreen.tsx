import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Mail, User as UserIcon, Shield, Cloud, Bell, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SignUpScreenProps {
  onClose: () => void;
  onSignUp: (email: string, name: string, username?: string) => void;
}

export default function SignUpScreen({ onClose, onSignUp }: SignUpScreenProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const backgroundAnim1 = useRef(new Animated.Value(0)).current;
  const backgroundAnim2 = useRef(new Animated.Value(0)).current;
  const backgroundAnim3 = useRef(new Animated.Value(0)).current;
  const backgroundAnim4 = useRef(new Animated.Value(0)).current;
  const backgroundAnim5 = useRef(new Animated.Value(0)).current;
  const backgroundAnim6 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const emojiGroup1 = ['💾', '☁️', '🔒', '🛡️', '📱', '💻'];
  const emojiGroup2 = ['✨', '⭐️', '🌟', '💫', '🌠', '✅'];
  const emojiGroup3 = ['🎯', '🚀', '📊', '📈', '🎨', '🔔'];
  const emojiGroup4 = ['🔐', '🗝️', '🔑', '🎁', '💎', '🏆'];
  const emojiGroup5 = ['📲', '🌐', '💬', '📧', '✉️', '📮'];
  const emojiGroup6 = ['🎉', '🎊', '🎈', '🌈', '💝', '🎀'];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim1, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim1, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim2, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim2, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim3, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim3, {
          toValue: 0,
          duration: 10000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim4, {
          toValue: 1,
          duration: 14000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim4, {
          toValue: 0,
          duration: 14000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim5, {
          toValue: 1,
          duration: 9000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim5, {
          toValue: 0,
          duration: 9000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim6, {
          toValue: 1,
          duration: 11000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim6, {
          toValue: 0,
          duration: 11000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [backgroundAnim1, backgroundAnim2, backgroundAnim3, backgroundAnim4, backgroundAnim5, backgroundAnim6, pulseAnim]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async () => {
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (username.trim() && !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      setError('Username must be 3-20 characters (letters, numbers, underscore)');
      return;
    }

    setIsLoading(true);

    try {
      await onSignUp(email, name, username.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      setIsLoading(false);
    }
  };

  const backgroundTransform1 = {
    transform: [
      {
        translateX: backgroundAnim1.interpolate({
          inputRange: [0, 1],
          outputRange: [-screenWidth * 0.3, screenWidth * 0.3],
        }),
      },
      {
        translateY: backgroundAnim1.interpolate({
          inputRange: [0, 1],
          outputRange: [-screenHeight * 0.2, screenHeight * 0.2],
        }),
      },
      {
        scale: backgroundAnim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.2, 1],
        }),
      },
    ],
  };

  const backgroundTransform2 = {
    transform: [
      {
        translateX: backgroundAnim2.interpolate({
          inputRange: [0, 1],
          outputRange: [screenWidth * 0.4, -screenWidth * 0.4],
        }),
      },
      {
        translateY: backgroundAnim2.interpolate({
          inputRange: [0, 1],
          outputRange: [screenHeight * 0.3, -screenHeight * 0.1],
        }),
      },
      {
        scale: backgroundAnim2.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1.1, 0.9, 1.1],
        }),
      },
    ],
  };

  const backgroundTransform3 = {
    transform: [
      {
        translateX: backgroundAnim3.interpolate({
          inputRange: [0, 1],
          outputRange: [screenWidth * 0.2, -screenWidth * 0.2],
        }),
      },
      {
        translateY: backgroundAnim3.interpolate({
          inputRange: [0, 1],
          outputRange: [-screenHeight * 0.1, screenHeight * 0.3],
        }),
      },
      {
        rotate: backgroundAnim3.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  const backgroundTransform4 = {
    transform: [
      {
        translateX: backgroundAnim4.interpolate({
          inputRange: [0, 1],
          outputRange: [-screenWidth * 0.5, screenWidth * 0.5],
        }),
      },
      {
        translateY: backgroundAnim4.interpolate({
          inputRange: [0, 1],
          outputRange: [screenHeight * 0.4, -screenHeight * 0.2],
        }),
      },
      {
        scale: backgroundAnim4.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.8, 1.3, 0.8],
        }),
      },
    ],
  };

  const backgroundTransform5 = {
    transform: [
      {
        translateX: backgroundAnim5.interpolate({
          inputRange: [0, 1],
          outputRange: [screenWidth * 0.3, -screenWidth * 0.6],
        }),
      },
      {
        translateY: backgroundAnim5.interpolate({
          inputRange: [0, 1],
          outputRange: [-screenHeight * 0.3, screenHeight * 0.1],
        }),
      },
      {
        rotate: backgroundAnim5.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '-90deg'],
        }),
      },
    ],
  };

  const backgroundTransform6 = {
    transform: [
      {
        translateX: backgroundAnim6.interpolate({
          inputRange: [0, 1],
          outputRange: [screenWidth * 0.6, -screenWidth * 0.3],
        }),
      },
      {
        translateY: backgroundAnim6.interpolate({
          inputRange: [0, 1],
          outputRange: [screenHeight * 0.2, -screenHeight * 0.4],
        }),
      },
      {
        scale: backgroundAnim6.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1.2, 0.7, 1.2],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1A1A1A', '#000000']}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View style={[styles.floatingEmoji1, backgroundTransform1]}>
        {emojiGroup1.map((emoji, index) => (
          <Text key={index} style={[styles.emoji, { 
            top: (index * 60) % 200,
            left: (index * 80) % 150,
            opacity: 0.6
          }]}>
            {emoji}
          </Text>
        ))}
      </Animated.View>

      <Animated.View style={[styles.floatingEmoji2, backgroundTransform2]}>
        {emojiGroup2.map((emoji, index) => (
          <Text key={index} style={[styles.emoji, { 
            top: (index * 70) % 180,
            right: (index * 90) % 120,
            opacity: 0.5
          }]}>
            {emoji}
          </Text>
        ))}
      </Animated.View>

      <Animated.View style={[styles.floatingEmoji3, backgroundTransform3]}>
        {emojiGroup3.map((emoji, index) => (
          <Text key={index} style={[styles.emoji, { 
            bottom: (index * 50) % 160,
            left: (index * 100) % 140,
            opacity: 0.4
          }]}>
            {emoji}
          </Text>
        ))}
      </Animated.View>

      <Animated.View style={[styles.floatingEmoji4, backgroundTransform4]}>
        {emojiGroup4.map((emoji, index) => (
          <Text key={index} style={[styles.emoji, { 
            top: (index * 80) % 220,
            right: (index * 60) % 100,
            opacity: 0.3
          }]}>
            {emoji}
          </Text>
        ))}
      </Animated.View>

      <Animated.View style={[styles.floatingEmoji5, backgroundTransform5]}>
        {emojiGroup5.map((emoji, index) => (
          <Text key={index} style={[styles.emoji, { 
            bottom: (index * 90) % 200,
            right: (index * 70) % 130,
            opacity: 0.5
          }]}>
            {emoji}
          </Text>
        ))}
      </Animated.View>

      <Animated.View style={[styles.floatingEmoji6, backgroundTransform6]}>
        {emojiGroup6.map((emoji, index) => (
          <Text key={index} style={[styles.emoji, { 
            top: (index * 40) % 180,
            left: (index * 110) % 160,
            opacity: 0.4
          }]}>
            {emoji}
          </Text>
        ))}
      </Animated.View>

      <LinearGradient
        colors={['rgba(0, 0, 0, 0.3)', 'transparent', 'rgba(0, 0, 0, 0.2)']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close sign up"
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.header}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={['#29202b', '#8B5CF6', '#A855F7']}
                  style={styles.iconGradient}
                >
                  <Shield size={40} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <Text style={styles.title}>Save Your Progress</Text>
              <Text style={styles.subtitle}>
                Sign up to keep your roadmap and tasks saved across all your devices
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <UserIcon size={20} color="#9A9A9A" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="#666666"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  testID="name-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <UserIcon size={20} color="#9A9A9A" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Username (optional)"
                  placeholderTextColor="#666666"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="username-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Mail size={20} color="#9A9A9A" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Your email"
                  placeholderTextColor="#666666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="email-input"
                />
              </View>

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
                onPress={handleSignUp}
                disabled={isLoading}
                accessibilityLabel="Sign up"
                testID="signup-button"
              >
                <LinearGradient
                  colors={['#6C63FF', '#3DBEFF', '#00E6E6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signUpButtonGradient}
                >
                  <Text style={styles.signUpButtonText}>
                    {isLoading ? 'Signing Up...' : 'Sign Up & Continue'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={onClose}
                accessibilityLabel="Skip for now"
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.features}>
              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Cloud size={24} color="#00E6E6" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Cloud Sync</Text>
                  <Text style={styles.featureDescription}>Access from anywhere</Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Lock size={24} color="#00E6E6" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Secure Storage</Text>
                  <Text style={styles.featureDescription}>Your data is protected</Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Bell size={24} color="#00E6E6" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Smart Reminders</Text>
                  <Text style={styles.featureDescription}>Stay on track daily</Text>
                </View>
              </View>
            </View>

            <Text style={styles.disclaimer}>
              By signing up, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingEmoji1: {
    position: 'absolute',
    top: -screenHeight * 0.2,
    left: -screenWidth * 0.2,
    width: screenWidth * 1.4,
    height: screenHeight * 0.8,
  },
  floatingEmoji2: {
    position: 'absolute',
    top: screenHeight * 0.3,
    right: -screenWidth * 0.3,
    width: screenWidth * 1.2,
    height: screenHeight * 0.6,
  },
  floatingEmoji3: {
    position: 'absolute',
    bottom: -screenHeight * 0.1,
    left: -screenWidth * 0.1,
    width: screenWidth * 1.3,
    height: screenHeight * 0.7,
  },
  floatingEmoji4: {
    position: 'absolute',
    top: -screenHeight * 0.3,
    right: -screenWidth * 0.4,
    width: screenWidth * 1.5,
    height: screenHeight * 0.9,
  },
  floatingEmoji5: {
    position: 'absolute',
    bottom: -screenHeight * 0.2,
    right: -screenWidth * 0.2,
    width: screenWidth * 1.3,
    height: screenHeight * 0.8,
  },
  floatingEmoji6: {
    position: 'absolute',
    top: -screenHeight * 0.1,
    left: -screenWidth * 0.3,
    width: screenWidth * 1.6,
    height: screenHeight * 1.0,
  },
  emoji: {
    position: 'absolute',
    fontSize: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
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
    paddingHorizontal: 20,
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
    height: 56,
  },
  inputIconContainer: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    height: '100%',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  signUpButton: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#9A9A9A',
    textDecorationLine: 'underline' as const,
  },
  features: {
    marginBottom: 32,
    gap: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 230, 230, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#9A9A9A',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
});
