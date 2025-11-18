import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Image, useWindowDimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAmbition } from '../hooks/ambition-store';

export default function SplashScreen() {
  const ambitionData = useAmbition();
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Safely destructure with fallbacks
  const goal = ambitionData?.goal || '';
  const roadmap = ambitionData?.roadmap || null;
  const isHydrated = ambitionData?.isHydrated || false;

  const { width } = useWindowDimensions();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  
  // Local logo asset
  const logoSource = require('../assets/images/logo-main.png');

  useEffect(() => {
    // Start background animation
    const backgroundAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    );
    backgroundAnimation.start();

    // Logo fade animation
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Local asset loads immediately, no prefetch needed
      setImageLoaded(true);
    
    return () => {
      backgroundAnimation.stop();
    };
  }, [animatedValue, fadeValue]);

  useEffect(() => {
    if (!imageLoaded || !isHydrated) return;
    
    const timer = setTimeout(() => {
      try {
        // Check if user has existing goal and roadmap
        // Add null checks to prevent undefined errors
        if (goal && roadmap && typeof goal === 'string' && typeof roadmap === 'object') {
          console.log('Existing goal found, navigating to roadmap');
          router.replace('/(main)/roadmap');
        } else {
          console.log('No existing goal, navigating to welcome');
          router.replace('/welcome');
        }
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback navigation
        router.replace('/welcome');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [imageLoaded, isHydrated, goal, roadmap]);

  // Show loading state until hydrated or if ambition data is not available
  if (!isHydrated || !ambitionData) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#29202B', '#000000']}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFillObject]}>
        <LinearGradient
          colors={['#000000', '#29202B', '#000000']}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View 
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.3, 0]
              })
            }
          ]}
        >
          <LinearGradient
            colors={['#1a0a1f', '#3d2a42', '#1a0a1f']}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </Animated.View>
      
      <View style={styles.content}>
        <View style={styles.logoContainer} accessibilityLabel="App logo">
          <Animated.View 
            style={[
              styles.logoImageContainer, 
              { 
                width: width * 0.8, 
                height: width * 0.8,
                opacity: fadeValue
              }
            ]}
          >
            {imageLoaded && (
              <Image
                source={logoSource}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="Ambitionly logo"
              />
            )}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginTop: -120,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
