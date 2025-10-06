import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { useAmbition } from '@/hooks/ambition-store';

export default function QuestionsIntroScreen() {
  const { goal } = useAmbition();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
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
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleContinue = () => {
    router.push('/questions-new');
  };

  return (
    <LinearGradient
      colors={['#000000', '#29202B']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MessageCircle size={48} color="#00E6E6" />
            </View>
            <Text style={styles.title}>Goal Analysis</Text>
            <Text style={styles.subtitle}>
              Perfect! Now I need to learn more about your goal to create the best roadmap for you.
            </Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.goalLabel}>Your Goal:</Text>
            <View style={styles.goalCard}>
              <Text style={styles.goalText}>&ldquo;{goal}&rdquo;</Text>
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>What to Expect</Text>
            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <View style={styles.detailBullet} />
                <Text style={styles.detailText}>6 personalized questions</Text>
              </View>
              <View style={styles.detailItem}>
                <View style={styles.detailBullet} />
                <Text style={styles.detailText}>About your background & experience</Text>
              </View>
              <View style={styles.detailItem}>
                <View style={styles.detailBullet} />
                <Text style={styles.detailText}>Takes 2-3 minutes to complete</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <LinearGradient
              colors={['#29202b', '#8B5CF6', '#A855F7']}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>Start Analysis</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 230, 230, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    paddingHorizontal: 20,
  },
  infoContainer: {
    marginBottom: 40,
  },
  goalLabel: {
    fontSize: 14,
    color: '#9A9A9A',
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  goalCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  goalText: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 22,
  },
  detailsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailsList: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E6E6',
    marginRight: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#B0B0B0',
    flex: 1,
  },
  footer: {
    paddingVertical: 24,
  },
  continueButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 8,
  },
});