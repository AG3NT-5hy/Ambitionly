import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, LexendDeca_400Regular, LexendDeca_600SemiBold } from '@expo-google-fonts/lexend-deca';

interface TrailSegment {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
}

interface ShootingStar {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  initialY: number;
  trail: TrailSegment[];
  angle: number;
}

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [showNoRoadmapMessage, setShowNoRoadmapMessage] = useState(false);
  
  // Check if we should show the "no roadmap" message
  useEffect(() => {
    if (params.noRoadmap === 'true') {
      setShowNoRoadmapMessage(true);
      // Hide message after 5 seconds
      const timer = setTimeout(() => {
        setShowNoRoadmapMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [params.noRoadmap]);
  
  // Create dynamic styles based on screen dimensions and insets
  const dynamicStyles = StyleSheet.create({
    signInButton: {
      position: 'absolute',
      bottom: Platform.select({
        ios: insets.bottom + 50,
        android: 60,
        default: 60,
      }),
      left: 20,
      zIndex: 1000,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: 'rgba(139, 92, 246, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.3)',
    },
  });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  
  // Create dynamic styles based on screen dimensions
  const styles = createStyles(width, height);

  // Individual element animations for staggered flow
  const welcomeTextAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const emojiAnim = useRef(new Animated.Value(0)).current;
  const descriptionAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;

  // Slide animations for each element
  const welcomeSlide = useRef(new Animated.Value(30)).current;
  const titleSlide = useRef(new Animated.Value(40)).current;
  const emojiSlide = useRef(new Animated.Value(20)).current;
  const descriptionSlide = useRef(new Animated.Value(50)).current;
  const featuresSlide = useRef(new Animated.Value(60)).current;

  // Floating animations
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  
  // Background flow animations - single smooth linear flow
  const backgroundFlow = useRef(new Animated.Value(0)).current;
  
  const timeouts = useRef<NodeJS.Timeout[]>([]).current;
  
  const shootingStars = useRef<ShootingStar[]>(
    Array.from({ length: 8 }, (_, i) => {
      const initialY = Math.random() * height * 0.6;
      const angle = 15 + Math.random() * 20; // Angle between 15-35 degrees (top-left to bottom-right)
      const trailSegments = Array.from({ length: 20 }, () => ({
        x: new Animated.Value(-100),
        y: new Animated.Value(initialY),
        opacity: new Animated.Value(0),
      }));
      
      return {
        id: i,
        x: new Animated.Value(-100),
        y: new Animated.Value(initialY),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.8 + Math.random() * 0.4),
        initialY,
        trail: trailSegments,
        angle,
      };
    })
  ).current;
  
  const [fontsLoaded, fontError] = useFonts({
    LexendDeca_400Regular,
    LexendDeca_600SemiBold,
  });

  const animateShootingStar = useCallback((star: ShootingStar) => {
    const newY = Math.random() * height * 0.4; // Start from upper area
    const newAngle = 25 + Math.random() * 15; // 25-40 degrees for more natural trajectory
    const duration = 4000 + Math.random() * 3000; // Much slower: 4-7 seconds
    const distance = width + 300;
    const verticalDistance = Math.tan((newAngle * Math.PI) / 180) * distance;
    
    // Reset star position
    star.x.setValue(-100);
    star.y.setValue(newY);
    star.opacity.setValue(0);
    star.initialY = newY;
    star.angle = newAngle;
    
    // Reset trail segments to follow the star closely
    star.trail.forEach((segment, index) => {
      segment.x.setValue(-100 - (index * 3)); // Closer spacing
      segment.y.setValue(newY - (Math.tan((newAngle * Math.PI) / 180) * index * 3));
      segment.opacity.setValue(0);
    });
    
    // Animate the main star
    const starAnimation = Animated.parallel([
      Animated.timing(star.x, {
        toValue: distance,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(star.y, {
        toValue: newY + verticalDistance,
        duration,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(star.opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(star.opacity, {
          toValue: 0,
          duration: duration - 200,
          delay: 100,
          useNativeDriver: true,
        }),
      ]),
    ]);
    
    // Animate trail segments to follow the star closely
    const trailAnimations = star.trail.map((segment, index) => {
      const delay = index * 30; // Reduced delay for tighter trail
      const segmentDuration = duration - delay;
      const segmentDistance = distance + (index * 3); // Closer to star
      const segmentVerticalDistance = Math.tan((newAngle * Math.PI) / 180) * segmentDistance;
      
      return Animated.parallel([
        Animated.timing(segment.x, {
          toValue: segmentDistance,
          duration: segmentDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(segment.y, {
          toValue: newY + segmentVerticalDistance,
          duration: segmentDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(segment.opacity, {
            toValue: Math.max(0.1, 0.8 - (index * 0.04)), // More consistent opacity
            duration: 100,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(segment.opacity, {
            toValue: 0,
            duration: segmentDuration - 200,
            delay: 100,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });
    
    Animated.parallel([starAnimation, ...trailAnimations]).start(() => {
      const timeout = setTimeout(() => animateShootingStar(star), Math.random() * 1500 + 1500) as unknown as NodeJS.Timeout; // More consistent timing: 1.5-3 seconds
      timeouts.push(timeout);
    });
  }, [width, height, timeouts]);

  useEffect(() => {
    // Staggered entrance animations for smooth flow
    const staggerDelay = 200;

    // Welcome text animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(welcomeTextAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(welcomeSlide, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 0);

    // Title animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(titleSlide, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 1);

    // Emoji animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(emojiAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(emojiSlide, {
          toValue: 0,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 2);

    // Description animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(descriptionAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.spring(descriptionSlide, {
          toValue: 0,
          tension: 55,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 3);

    // Features animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(featuresAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(featuresSlide, {
          toValue: 0,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 4);

    // Button animation
    setTimeout(() => {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }, staggerDelay * 5);

    // Overall fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    // Continuous floating animations
    const createFloatingAnimation = (animValue: Animated.Value, duration: number, delay: number = 0) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };

      setTimeout(() => animate(), delay);
    };

    createFloatingAnimation(floatAnim1, 3000, 0);
    createFloatingAnimation(floatAnim2, 4000, 1000);
    createFloatingAnimation(floatAnim3, 3500, 2000);

    // Single smooth linear gradient flow animation
    const createBackgroundFlow = () => {
      const animate = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(backgroundFlow, {
              toValue: 1,
              duration: Platform.OS === 'android' ? 8000 : 10000,
              useNativeDriver: true,
            }),
            Animated.timing(backgroundFlow, {
              toValue: 0,
              duration: Platform.OS === 'android' ? 8000 : 10000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      animate();
    };

    createBackgroundFlow();

    shootingStars.forEach((star, index) => {
      const timeout = setTimeout(() => animateShootingStar(star), index * 400 + Math.random() * 500) as unknown as NodeJS.Timeout; // More frequent staggered start
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.length = 0;
    };
  }, [
    animateShootingStar, 
    fadeAnim, 
    shootingStars, 
    timeouts,
    buttonScale,
    welcomeTextAnim,
    titleAnim,
    emojiAnim,
    descriptionAnim,
    featuresAnim,
    welcomeSlide,
    titleSlide,
    emojiSlide,
    descriptionSlide,
    featuresSlide,
    floatAnim1,
    floatAnim2,
    floatAnim3,
    backgroundFlow
  ]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={['#000000', '#29202B', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontFamily: 'System' }}>Loading...</Text>
      </View>
    );
  }

  const handleStartJourney = () => {
    router.push('/onboarding');
  };

  const handleSignIn = () => {
    router.push('/auth?mode=signin&from=welcome');
  };

  const titleFontFamily = fontsLoaded ? 'LexendDeca_600SemiBold' : 'System';

  return (
    <View style={styles.container}>
      {/* Subtle Sign In button in bottom left */}
      <TouchableOpacity
        style={dynamicStyles.signInButton}
        onPress={handleSignIn}
        activeOpacity={0.7}
      >
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>
      
      {/* Original flowing background */}
      <LinearGradient
        colors={['#000000', '#29202B', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Single smooth linear gradient flow */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: backgroundFlow.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1],
            }),
            transform: [
              {
                translateY: backgroundFlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-height * 0.3, height * 0.3],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', '#8B5CF6', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      {shootingStars.map((star) => (
        <View key={star.id}>
          {/* Trail segments */}
          {star.trail.map((segment, index) => (
            <Animated.View
              key={`${star.id}-trail-${index}`}
              style={[
                styles.trailSegment,
                {
                  transform: [
                    { translateX: segment.x },
                    { translateY: segment.y },
                    { rotate: `${star.angle}deg` },
                  ],
                  opacity: segment.opacity,
                },
              ]}
            >
              <LinearGradient
                colors={[
                  index < 2 ? '#B0B0B0' : index < 4 ? '#9090A0' : index < 6 ? '#6B46C1' : index < 8 ? '#553C9A' : '#4C1D95',
                  index < 3 ? '#6B46C1' : index < 6 ? '#553C9A' : index < 9 ? '#4C1D95' : '#3C1361',
                  'transparent'
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.trailGradient,
                  {
                    width: Math.max(2, 30 - (index * 1.5)), // Shorter trail segments
                    height: Math.max(0.5, 1.5 - (index * 0.05)), // Slightly thicker for better visibility
                  }
                ]}
              />
            </Animated.View>
          ))}
          
          {/* Main star */}
          <Animated.View
            style={[
              styles.shootingStar,
              {
                transform: [
                  { translateX: star.x },
                  { translateY: star.y },
                  { scale: star.scale },
                  { rotate: `${star.angle}deg` },
                ],
                opacity: star.opacity,
              },
            ]}
          >
            <View style={styles.starCore} />
            <View style={styles.starGlow} />
          </Animated.View>
        </View>
      ))}
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.animatedView,
                {
                  opacity: welcomeTextAnim,
                  transform: [
                    { translateY: welcomeSlide },
                    { translateY: Animated.multiply(floatAnim1, 3) },
                  ],
                }
              ]}
            >
              <Text style={styles.welcomeText}>Welcome to</Text>
            </Animated.View>
            
            <Animated.View
              style={[
                styles.animatedView,
                {
                  opacity: titleAnim,
                  transform: [
                    { translateY: titleSlide },
                    { scale: Animated.add(1, Animated.multiply(floatAnim2, 0.02)) },
                  ],
                }
              ]}
            >
              <Text style={[styles.appTitle, { fontFamily: titleFontFamily }]}>Ambitionly</Text>
            </Animated.View>
            
            <Animated.View
              style={[
                styles.animatedView,
                {
                  opacity: emojiAnim,
                  transform: [
                    { translateY: emojiSlide },
                    { rotate: floatAnim3.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-5deg', '5deg'],
                    }) },
                    { scale: Animated.add(1, Animated.multiply(floatAnim1, 0.1)) },
                  ],
                }
              ]}
            >
              <Text style={styles.emoji}>👋</Text>
            </Animated.View>
          </View>

          <Animated.View 
            style={[
              styles.description,
              {
                opacity: descriptionAnim,
                transform: [
                  { translateY: descriptionSlide },
                  { translateY: Animated.multiply(floatAnim2, -2) },
                ],
              }
            ]}
          >
            {showNoRoadmapMessage && (
              <View style={styles.noRoadmapMessage}>
                <Text style={styles.noRoadmapMessageText}>
                  You don't have a goal/roadmap yet. Start your journey below!
                </Text>
              </View>
            )}
            <Text style={styles.descriptionText}>
              Your AI coach to transform goals into action
            </Text>
            <Text style={styles.subText}>
              Turn vague ambitions into clear, achievable roadmaps with personalized guidance every step of the way.
            </Text>
          </Animated.View>

          <Animated.View 
            style={[
              styles.features,
              {
                opacity: featuresAnim,
                transform: [
                  { translateY: featuresSlide },
                ],
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.feature,
                {
                  transform: [
                    { translateY: Animated.multiply(floatAnim1, 2) },
                    { scale: Animated.add(1, Animated.multiply(floatAnim1, 0.01)) },
                  ],
                }
              ]}
            >
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureText}>Smart Goal Analysis</Text>
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.feature,
                {
                  transform: [
                    { translateY: Animated.multiply(floatAnim2, -2) },
                    { scale: Animated.add(1, Animated.multiply(floatAnim2, 0.01)) },
                  ],
                }
              ]}
            >
              <Text style={styles.featureIcon}>🗺️</Text>
              <Text style={styles.featureText}>Personalized Roadmaps</Text>
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.feature,
                {
                  transform: [
                    { translateY: Animated.multiply(floatAnim3, 2) },
                    { scale: Animated.add(1, Animated.multiply(floatAnim3, 0.01)) },
                  ],
                }
              ]}
            >
              <Text style={styles.featureIcon}>📈</Text>
              <Text style={styles.featureText}>Progress Tracking</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.buttonContainer,
              {
                transform: [
                  { scale: buttonScale },
                  { translateY: Animated.multiply(floatAnim2, 3) },
                ],
              },
            ]}
          >
            <TouchableOpacity 
              onPress={handleStartJourney} 
              activeOpacity={0.8}
              style={styles.touchableOpacity}
            >
              <Animated.View
                style={[
                  styles.animatedView,
                  {
                    transform: [
                      { scale: Animated.add(1, Animated.multiply(floatAnim1, 0.02)) },
                    ],
                  }
                ]}
              >
                <LinearGradient
                  colors={['#29202b', '#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.startButton}
                >
                  <Text style={styles.startButtonText}>Start Your Journey</Text>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const createStyles = (screenWidth: number, screenHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Platform.select({
      android: Math.max(16, screenWidth * 0.05),
      ios: 24,
      default: 24,
    }),
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.select({
      android: Math.max(20, screenHeight * 0.02),
      ios: 20,
      default: 20,
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: Platform.select({
      android: Math.max(16, screenWidth * 0.045),
      ios: 24,
      default: 24,
    }),
    color: '#E0E0E0',
    marginBottom: Math.max(6, screenHeight * 0.01),
    fontFamily: 'System',
    fontWeight: '300',
  },
  appTitle: {
    fontSize: Platform.select({
      android: Math.max(24, screenWidth * 0.07),
      ios: 38,
      default: 38,
    }),
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'System',
    letterSpacing: 1,
    marginBottom: Math.max(6, screenHeight * 0.01),
  },
  emoji: {
    fontSize: 32,
  },
  description: {
    alignItems: 'center',
    marginBottom: Math.max(20, screenHeight * 0.025),
    flex: 1,
    justifyContent: 'center',
  },
  descriptionText: {
    fontSize: Platform.select({
      android: Math.max(14, screenWidth * 0.04),
      ios: 18,
      default: 18,
    }),
    color: '#9A9A9A',
    textAlign: 'center',
    marginBottom: Math.max(12, screenHeight * 0.015),
    fontFamily: 'System',
    fontWeight: '400',
  },
  subText: {
    fontSize: Platform.select({
      android: Math.max(12, screenWidth * 0.035),
      ios: 16,
      default: 16,
    }),
    color: '#666666',
    textAlign: 'center',
    lineHeight: Platform.select({
      android: Math.max(18, screenWidth * 0.05),
      ios: 24,
      default: 24,
    }),
    paddingHorizontal: Math.max(12, screenWidth * 0.03),
    fontFamily: 'System',
    fontWeight: '300',
  },
  features: {
    width: '100%',
    marginBottom: 32,
  },
  feature: {
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: '#E0E0E0',
    fontWeight: '500',
    fontFamily: 'System',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    marginTop: 16,
    paddingBottom: 32,
  },
  startButton: {
    paddingVertical: Platform.select({
      android: Math.max(16, screenHeight * 0.02),
      ios: 24,
      default: 24,
    }),
    paddingHorizontal: Platform.select({
      android: Math.max(40, screenWidth * 0.1),
      ios: 64,
      default: 64,
    }),
    borderRadius: Math.max(24, screenWidth * 0.06),
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: {
    fontSize: Platform.select({
      android: Math.max(14, screenWidth * 0.04),
      ios: 18,
      default: 18,
    }),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'System',
    letterSpacing: 1,
  },
  shootingStar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailSegment: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailGradient: {
    borderRadius: 1,
  },
  starCore: {
    width: 3, // Slightly larger darker core (head)
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D0D0D0',
    position: 'absolute',
    zIndex: 2,
    shadowColor: '#D0D0D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
  },
  starGlow: {
    width: 6, // Darker purple glow (body)
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B46C1',
    opacity: 0.5,
    position: 'absolute',
    zIndex: 1,
  },
  touchableOpacity: {
    transform: [{ scale: 1 }],
  },
  animatedView: {
    // Base style for animated views
  },
  signInButtonText: {
    color: '#B0A8FF',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  noRoadmapMessage: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  noRoadmapMessageText: {
    color: '#B0A8FF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
});