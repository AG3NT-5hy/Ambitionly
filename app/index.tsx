import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAmbition } from '../hooks/ambition-store';

export default function SplashScreen() {
  const ambitionData = useAmbition();
  
  // Safely destructure with fallbacks
  const goal = ambitionData?.goal || '';
  const roadmap = ambitionData?.roadmap || null;
  const isHydrated = ambitionData?.isHydrated || false;

  useEffect(() => {
    if (!isHydrated || !ambitionData) return;
    
    // Navigate immediately without delay or splash screen
    try {
      // Check if user has existing goal and roadmap
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
  }, [isHydrated, ambitionData, goal, roadmap]);

  // Show minimal loading state until hydrated
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

  // Return null while navigating (should be instant)
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
