import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAmbition } from '../hooks/ambition-store'
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

export default function GeneratingScreen() {
  const { generateRoadmap } = useAmbition();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const rotationAnim = useRef(new Animated.Value(0)).current;
  
  // Create dynamic styles based on screen dimensions
  const styles = createStyles(screenWidth, screenHeight);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const hasGeneratedRef = useRef(false);
  
  // Image URIs
  const logoUri = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/cixvx1m8voutz5e0sag12';
  const fallbackUri = 'https://via.placeholder.com/110x110/29202B/FFFFFF?text=Logo';
  
  // Background animation values
  const backgroundAnim1 = useRef(new Animated.Value(0)).current;
  const backgroundAnim2 = useRef(new Animated.Value(0)).current;
  const backgroundAnim3 = useRef(new Animated.Value(0)).current;
  const backgroundAnim4 = useRef(new Animated.Value(0)).current;
  const backgroundAnim5 = useRef(new Animated.Value(0)).current;
  const backgroundAnim6 = useRef(new Animated.Value(0)).current;
  const colorShiftAnim = useRef(new Animated.Value(0)).current;
  
  // Emoji arrays for different animation groups
  const emojiGroup1 = ['🎯', '💸', '🗻', '🫶🏻', '🙌🏻', '🫴🏻'];
  const emojiGroup2 = ['👊🏻', '💪🏻', '🫀', '🧠', '👀', '🗣️'];
  const emojiGroup3 = ['🥷🏻', '⭐️', '🌟', '✨', '☀️', '🌙'];
  const emojiGroup4 = ['🌔', '🌑', '🌊', '🧩', '⛰️', '🏔️'];
  const emojiGroup5 = ['🌋', '🌄', '🌠', '🎆', '🎇', '🌇'];
  const emojiGroup6 = ['🏞️', '🌅', '🏛️', '❤️‍🩹', '❤️‍🔥', '🤍', '❣️', '🔱', '🎴'];

  useEffect(() => {
    // Start rotation animation
    const startRotation = () => {
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: Platform.OS === 'android' ? 4000 : 3000, // Slower on Android for smoother animation
          useNativeDriver: true,
        })
      ).start();
    };
    
    // Start background animations (reduced complexity for Android)
    const startBackgroundAnimations = () => {
      const animationDuration = Platform.OS === 'android' ? 12000 : 8000;
      
      // Floating emoji group 1
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundAnim1, {
            toValue: 1,
            duration: animationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(backgroundAnim1, {
            toValue: 0,
            duration: animationDuration,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Floating emoji group 2
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
      
      // Floating emoji group 3
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
      
      // Floating emoji group 4
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
      
      // Floating emoji group 5
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
      
      // Floating emoji group 6
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
      
      // Color shifting animation
      Animated.loop(
        Animated.timing(colorShiftAnim, {
          toValue: 1,
          duration: 15000,
          useNativeDriver: false,
        })
      ).start();
    };
    
    startRotation();
    startBackgroundAnimations();
    
    // Generate roadmap and navigate immediately (only once)
    const generateAndNavigate = async () => {
      if (hasGeneratedRef.current || isGenerating) {
        console.log('[Generating] Already generating or generated, skipping');
        return;
      }
      
      try {
        console.log('[Generating] Starting roadmap generation');
        hasGeneratedRef.current = true;
        setIsGenerating(true);
        setError(null);
        await generateRoadmap();
        console.log('[Generating] Roadmap generation completed, navigating');
        // Navigate immediately after generation completes
        router.replace('/(main)/roadmap');
      } catch (error) {
        console.error('Error generating roadmap:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(errorMessage);
        hasGeneratedRef.current = false; // Allow retry
        setIsGenerating(false);
        // Don't navigate on error, let user retry
      }
    };

    generateAndNavigate();
  }, []); // Empty dependency array - only run once on mount
  
  const handleRetry = async () => {
    if (isGenerating) {
      console.log('[Generating] Already generating, skipping retry');
      return;
    }
    
    setIsRetrying(true);
    setError(null);
    hasGeneratedRef.current = false; // Reset flag for retry
    
    try {
      console.log('[Generating] Starting retry generation');
      setIsGenerating(true);
      await generateRoadmap();
      console.log('[Generating] Retry generation completed, navigating');
      router.replace('/(main)/roadmap');
    } catch (error) {
      console.error('Error generating roadmap on retry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsRetrying(false);
      setIsGenerating(false);
    }
  };
  
  const handleSkip = () => {
    // Navigate to roadmap even if generation failed
    router.replace('/(main)/roadmap');
  };
  
  // Animated background transforms
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
      {/* Base background */}
      <LinearGradient
        colors={['#000000', '#1A1A1A', '#000000']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Animated floating emojis */}
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
      
      {/* Subtle overlay for depth */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.3)', 'transparent', 'rgba(0, 0, 0, 0.2)']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.content}>
          {/* Quote at the top */}
          <View style={styles.topQuote}>
            <Text style={styles.quoteText}>
              &ldquo;Every Expert was once a Beginner. Every Pro was once an Amateur.&rdquo;
            </Text>
          </View>
          
          <View style={styles.centerContent}>
            <View style={styles.logoContainer}>
              <View style={styles.logoWrapper}>
                {/* Rotating border */}
                <Animated.View
                  style={[
                    styles.rotatingBorder,
                    {
                      transform: [
                        {
                          rotate: rotationAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#29202b', '#8B5CF6', '#A855F7']}
                    style={styles.borderGradient}
                  />
                </Animated.View>
                
                {/* Stationary logo */}
                <View style={styles.logoInner}>
                  <Image 
                    source={{ uri: logoUri || fallbackUri }}
                    style={styles.logoImage}
                    resizeMode="contain"
                    onError={(error) => {
                      console.warn('Logo image failed to load:', error.nativeEvent.error);
                    }}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.title}>Crafting Your Roadmap</Text>
            <Text style={styles.subtitle}>
              Analyzing Your Goal And Creating Personalized Phases, Milestones, And Tasks
            </Text>

            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Processing Your Ambition</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Analyzing Your Timeline</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Creating Actionable Steps</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Personalizing Your Journey</Text>
              </View>
            </View>
            
            {error ? (
              <View style={styles.errorContainer}>
                <View style={styles.errorIconContainer}>
                  <AlertTriangle size={32} color="#FF6B6B" />
                </View>
                <Text style={styles.errorTitle}>Generation Failed</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                
                <View style={styles.errorActions}>
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={handleRetry}
                    disabled={isRetrying}
                  >
                    <LinearGradient
                      colors={['#6C63FF', '#3DBEFF']}
                      style={styles.retryButtonGradient}
                    >
                      <RefreshCw size={16} color="#FFFFFF" />
                      <Text style={styles.retryButtonText}>
                        {isRetrying ? 'Retrying...' : 'Try Again'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipButtonText}>Continue Anyway</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.bottomContent}>
                <Text style={styles.progressText}>Your Personalized Journey Awaits</Text>
              </View>
            )}
          </View>


        </View>
      </View>
    </View>
  );
}

const createStyles = (screenWidth: number, screenHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Math.max(20, screenWidth * 0.05),
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Math.max(40, screenHeight * 0.05),
  },
  topQuote: {
    paddingHorizontal: Math.max(16, screenWidth * 0.04),
    paddingVertical: Math.max(20, screenHeight * 0.025),
    width: '100%',
    alignItems: 'center',
  },
  quoteText: {
    fontSize: Platform.select({
      android: Math.max(14, screenWidth * 0.04),
      ios: 16,
      default: 16,
    }),
    color: '#B0B0B0',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: Platform.select({
      android: Math.max(20, screenWidth * 0.055),
      ios: 24,
      default: 24,
    }),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Platform.select({
      android: Math.max(32, screenHeight * 0.04),
      ios: 48,
      default: 48,
    }),
  },
  logoWrapper: {
    width: Platform.select({
      android: Math.max(100, screenWidth * 0.25),
      ios: 124,
      default: 124,
    }),
    height: Platform.select({
      android: Math.max(100, screenWidth * 0.25),
      ios: 124,
      default: 124,
    }),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rotatingBorder: {
    position: 'absolute',
    width: Platform.select({
      android: Math.max(100, screenWidth * 0.25),
      ios: 124,
      default: 124,
    }),
    height: Platform.select({
      android: Math.max(100, screenWidth * 0.25),
      ios: 124,
      default: 124,
    }),
    borderRadius: Platform.select({
      android: Math.max(50, screenWidth * 0.125),
      ios: 62,
      default: 62,
    }),
  },
  borderGradient: {
    width: Platform.select({
      android: Math.max(100, screenWidth * 0.25),
      ios: 124,
      default: 124,
    }),
    height: Platform.select({
      android: Math.max(100, screenWidth * 0.25),
      ios: 124,
      default: 124,
    }),
    borderRadius: Platform.select({
      android: Math.max(50, screenWidth * 0.125),
      ios: 62,
      default: 62,
    }),
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
    width: Platform.select({
      android: Math.max(92, screenWidth * 0.23),
      ios: 116,
      default: 116,
    }),
    height: Platform.select({
      android: Math.max(92, screenWidth * 0.23),
      ios: 116,
      default: 116,
    }),
    borderRadius: Platform.select({
      android: Math.max(46, screenWidth * 0.115),
      ios: 58,
      default: 58,
    }),
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    zIndex: 1,
  },
  logoImage: {
    width: Platform.select({
      android: Math.max(86, screenWidth * 0.215),
      ios: 110,
      default: 110,
    }),
    height: Platform.select({
      android: Math.max(86, screenWidth * 0.215),
      ios: 110,
      default: 110,
    }),
    borderRadius: Platform.select({
      android: Math.max(43, screenWidth * 0.1075),
      ios: 55,
      default: 55,
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  statusContainer: {
    alignItems: 'flex-start',
    gap: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E6E6',
  },
  statusText: {
    fontSize: 16,
    color: '#E0E0E0',
    fontWeight: '600',
  },
  bottomContent: {
    marginTop: 48,
    alignItems: 'center',
    width: '100%',
  },
  progressText: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 48,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FF6B6B',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  retryButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#9A9A9A',
    textDecorationLine: 'underline' as const,
  },

});