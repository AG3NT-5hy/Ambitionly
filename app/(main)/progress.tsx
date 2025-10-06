import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Dimensions, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Target, Calendar, Flame, TrendingUp, Award } from 'lucide-react-native';
import { useAmbition } from '@/hooks/ambition-store';
import { SkeletonBlock } from '@/components/Skeleton';

const { width } = Dimensions.get('window');

const motivationalQuotes = [
  {
    text: "Success is the sum of small efforts repeated day in and day out.",
    author: "Robert Collier"
  },
  {
    text: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill"
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson"
  },
  {
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt"
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle"
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt"
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    text: "Progress, not perfection, is the goal.",
    author: "Unknown"
  },
  {
    text: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu"
  }
];

export default function ProgressScreen() {
  const { roadmap, completedTasks, getProgress, getStreak, getCompletedTasksThisWeek } = useAmbition();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [currentQuote, setCurrentQuote] = useState<{text: string; author: string}>(motivationalQuotes[0]);

  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }, []);

  useEffect(() => {
    // Select a random quote each time the screen loads
    const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
    setCurrentQuote(motivationalQuotes[randomIndex]);
    
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
  }, []);

  const progress = useMemo(() => getProgress(), [getProgress]);
  const streak = useMemo(() => getStreak(), [getStreak]);
  const weeklyTasks = useMemo(() => getCompletedTasksThisWeek(), [getCompletedTasksThisWeek]);

  const getTotalTasks = () => {
    if (!roadmap?.phases) return 0;
    return roadmap.phases.reduce((total, phase) => {
      return total + phase.milestones.reduce((milestoneTotal, milestone) => {
        return milestoneTotal + milestone.tasks.length;
      }, 0);
    }, 0);
  };

  const getCompletedPhases = () => {
    if (!roadmap?.phases) return 0;
    return roadmap.phases.filter(phase => {
      const phaseTasks = phase.milestones.flatMap(m => m.tasks);
      return phaseTasks.every(task => completedTasks.includes(task.id));
    }).length;
  };

  const getAchievements = () => {
    const achievements = [];
    
    if (completedTasks.length >= 1) {
      achievements.push({ id: 'first-task', title: 'First Step', description: 'Completed your first task', icon: '🎯', unlocked: true });
    }
    
    if (streak >= 3) {
      achievements.push({ id: 'streak-3', title: 'Consistent', description: '3-day streak', icon: '🔥', unlocked: true });
    }
    
    if (streak >= 7) {
      achievements.push({ id: 'streak-7', title: 'Dedicated', description: '7-day streak', icon: '⚡', unlocked: true });
    }
    
    if (completedTasks.length >= 10) {
      achievements.push({ id: 'tasks-10', title: 'Achiever', description: 'Completed 10 tasks', icon: '🏆', unlocked: true });
    }
    
    if (getCompletedPhases() >= 1) {
      achievements.push({ id: 'phase-1', title: 'Phase Master', description: 'Completed a full phase', icon: '🌟', unlocked: true });
    }

    // Add locked achievements
    if (streak < 3) {
      achievements.push({ id: 'streak-3', title: 'Consistent', description: '3-day streak', icon: '🔥', unlocked: false });
    }
    if (streak < 7) {
      achievements.push({ id: 'streak-7', title: 'Dedicated', description: '7-day streak', icon: '⚡', unlocked: false });
    }
    if (completedTasks.length < 10) {
      achievements.push({ id: 'tasks-10', title: 'Achiever', description: 'Completed 10 tasks', icon: '🏆', unlocked: false });
    }

    return achievements;
  };

  const achievements = getAchievements();
  const totalTasks = getTotalTasks();
  const completedPhases = getCompletedPhases();

  return (
    <LinearGradient colors={['#000000', '#29202B']} style={styles.container}>
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Progress</Text>
            <Text style={styles.headerSubtitle}>Track your journey to success</Text>
          </View>

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E6E6" />}>

            {!roadmap ? (
              <View style={styles.loadingCard}>
                <SkeletonBlock lines={1} lineHeight={24} />
                <View style={styles.loadingGrid}>
                  <SkeletonBlock lines={3} />
                </View>
              </View>
            ) : null}
            {/* Main Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#6C63FF', '#3DBEFF']}
                  style={styles.statGradient}
                >
                  <TrendingUp size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{Math.round(progress)}%</Text>
                  <Text style={styles.statLabel}>Overall Progress</Text>
                </LinearGradient>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E8E']}
                  style={styles.statGradient}
                >
                  <Flame size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{streak}</Text>
                  <Text style={styles.statLabel}>Day Streak</Text>
                </LinearGradient>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#32D583', '#4AE68A']}
                  style={styles.statGradient}
                >
                  <Target size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{completedTasks.length}</Text>
                  <Text style={styles.statLabel}>Tasks Done</Text>
                </LinearGradient>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#00E6E6', '#33EBEB']}
                  style={styles.statGradient}
                >
                  <Calendar size={24} color="#FFFFFF" />
                  <Text style={styles.statValue}>{weeklyTasks}</Text>
                  <Text style={styles.statLabel}>This Week</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Progress Breakdown */}
            <View style={styles.breakdownCard}>
              <Text style={styles.sectionTitle}>Progress Breakdown</Text>
              
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Tasks Completed</Text>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${(completedTasks.length / totalTasks) * 100}%` }]} />
                </View>
                <Text style={styles.breakdownText}>{completedTasks.length} / {totalTasks}</Text>
              </View>

              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Phases Completed</Text>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${(completedPhases / (roadmap?.phases?.length || 1)) * 100}%` }]} />
                </View>
                <Text style={styles.breakdownText}>{completedPhases} / {roadmap?.phases?.length || 0}</Text>
              </View>
            </View>

            {/* Achievements */}
            <View style={styles.achievementsCard}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <View style={styles.achievementsGrid}>
                {achievements.map((achievement) => (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementItem,
                      !achievement.unlocked && styles.achievementLocked,
                    ]}
                  >
                    <Text style={[
                      styles.achievementIcon,
                      !achievement.unlocked && styles.achievementIconLocked,
                    ]}>
                      {achievement.unlocked ? achievement.icon : '🔒'}
                    </Text>
                    <Text style={[
                      styles.achievementTitle,
                      !achievement.unlocked && styles.achievementTitleLocked,
                    ]}>
                      {achievement.title}
                    </Text>
                    <Text style={[
                      styles.achievementDescription,
                      !achievement.unlocked && styles.achievementDescriptionLocked,
                    ]}>
                      {achievement.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Motivational Quote */}
            <View style={styles.quoteCard} accessibilityLabel={`Motivational quote by ${currentQuote.author}`}>
              <Text style={styles.quoteText}>
                "{currentQuote.text}"
              </Text>
              <Text style={styles.quoteAuthor}>- {currentQuote.author}</Text>
            </View>
          </ScrollView>
        </Animated.View>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 52) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
  breakdownCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 16,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 8,
  },
  breakdownBar: {
    height: 8,
    backgroundColor: '#2D2D2D',
    borderRadius: 4,
    marginBottom: 4,
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: '#00E6E6',
    borderRadius: 4,
  },
  breakdownText: {
    fontSize: 12,
    color: '#9A9A9A',
    textAlign: 'right',
  },
  loadingCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  loadingGrid: {
    marginTop: 16,
  },
  achievementsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementItem: {
    width: (width - 84) / 2,
    backgroundColor: '#2D2D2D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  achievementLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementIconLocked: {
    opacity: 0.5,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  achievementTitleLocked: {
    color: '#666666',
  },
  achievementDescription: {
    fontSize: 12,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  achievementDescriptionLocked: {
    color: '#555555',
  },
  quoteCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
  },
});