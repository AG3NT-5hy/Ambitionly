import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Platform, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Circle, ArrowLeft, Lock, Play, Clock } from 'lucide-react-native';
import { useAmbition } from '@/hooks/ambition-store';
import { useSubscription } from '@/hooks/subscription-store';
import { router, Stack } from 'expo-router';
import { BlurView } from 'expo-blur';
import PaywallScreen from '@/components/PaywallScreen';
import { useUi } from '@/providers/UiProvider';

export default function PhasesScreen() {
  const { 
    roadmap, 
    completedTasks, 
    toggleTask, 
    isTaskUnlocked, 
    isMilestoneUnlocked, 
    isPhaseUnlocked,
    startTaskTimer,
    getTaskTimer,
    isTaskTimerComplete,
    getTaskTimerProgress
  } = useAmbition();
  const { shouldShowPaywall, canAccessPremiumFeatures, isHydrated } = useSubscription();
  const { showToast } = useUi();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [, setCurrentTime] = useState(Date.now());
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);

  const shouldShowPaywallNow = shouldShowPaywall(completedTasks.length);

  useEffect(() => {
    // Debug subscription state on Android
    if (Platform.OS === 'android') {
      console.log('[Android Phases Debug] Subscription state:', {
        completedTasksCount: completedTasks.length,
        shouldShowPaywall: shouldShowPaywallNow,
      });
    }
    
    // If user shouldn't have access, redirect them back or show paywall
    if (shouldShowPaywallNow) {
      setShowPaywallModal(true);
    }
    
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
  }, [fadeAnim, slideAnim, shouldShowPaywallNow]);

  // Update current time every second for timer progress
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTaskAction = async (taskId: string, phaseIndex: number, milestoneIndex: number, taskIndex: number, estimatedTime: string) => {
    // Input validation
    if (!estimatedTime?.trim()) {
      console.warn('Invalid estimated time provided');
      return;
    }
    const sanitizedTime = estimatedTime.trim().slice(0, 20);
    
    // Only allow action if task is unlocked
    if (!isTaskUnlocked(phaseIndex, milestoneIndex, taskIndex)) {
      return;
    }

    const timer = getTaskTimer(taskId);
    const isCompleted = completedTasks.includes(taskId);
    
    // If task is already completed, allow unchecking
    if (isCompleted) {
      await toggleTask(taskId);
      return;
    }
    
    // If no timer exists, start the timer
    if (!timer) {
      await startTaskTimer(taskId, sanitizedTime);
      showToast(`Timer started for ${sanitizedTime}`, 'success');
      return;
    }
    
    // If timer exists and is complete, allow marking as done
    if (timer && isTaskTimerComplete(taskId)) {
      const success = await toggleTask(taskId);
      if (success) {
        showToast('Great job! Task completed.', 'success');
      }
    } else {
      // Timer is running but not complete yet
      const progress = getTaskTimerProgress(taskId);
      const remainingMs = progress.total - progress.elapsed;
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
      
      showToast(`Please wait ${remainingMinutes} more minute(s) before completing.`, 'warning');
    }
  };

  const getTaskButtonContent = (taskId: string, estimatedTime: string) => {
    const timer = getTaskTimer(taskId);
    const isCompleted = completedTasks.includes(taskId);
    
    if (isCompleted) {
      return {
        icon: <CheckCircle2 size={20} color="#32D583" />,
        text: 'Completed'
      };
    }
    
    if (!timer) {
      return {
        icon: <Play size={16} color="#00E6E6" />,
        text: `Start (${estimatedTime})`
      };
    }
    
    if (isTaskTimerComplete(taskId)) {
      return {
        icon: <CheckCircle2 size={20} color="#32D583" />,
        text: 'Mark Complete'
      };
    }
    
    const progress = getTaskTimerProgress(taskId);
    const remainingMs = progress.total - progress.elapsed;
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    
    return {
      icon: <Clock size={16} color="#FFA500" />,
      text: `${remainingMinutes}m left`
    };
  };

  if (!roadmap) {
    return (
      <LinearGradient colors={['#000000', '#29202B']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading phases...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'All Phases',
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />
      <LinearGradient colors={['#000000', '#29202B']} style={styles.container}>
        <View style={styles.safeAreaBackground}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
          <ScrollView style={styles.phasesContainer} showsVerticalScrollIndicator={false}>
            {roadmap.phases.map((phase, phaseIndex) => {
              const phaseUnlocked = isPhaseUnlocked(phaseIndex);
              
              // Hide premium phases for non-subscribers
              const shouldHidePhase = Platform.OS === 'android' && 
                                    shouldShowPaywallNow && 
                                    phaseIndex > 0 && 
                                    !canAccessPremiumFeatures();
              
              if (shouldHidePhase) {
                return null; // Don't render premium phases if user doesn't have access
              }
              
              // Show subscription blur for premium content
              const isPremiumPhase = phaseIndex > 0 && shouldShowPaywallNow && !canAccessPremiumFeatures();
              const showSubscriptionBlur = isPremiumPhase;
              
              return (
                <View key={phase.id} style={styles.phaseCardContainer}>
                  <View style={[
                    styles.phaseCard,
                    (!phaseUnlocked || showSubscriptionBlur) && styles.lockedCard
                  ]}>
                  {(!phaseUnlocked || showSubscriptionBlur) ? (
                    // Show only lock indicator when locked
                    <View style={styles.lockedPhaseContent}>
                      <Lock size={28} color="#FFFFFF" />
                      <Text style={styles.phaseLockText}>
                        {showSubscriptionBlur ? 'Premium Phase - Subscribe to Unlock' : 'Phase Locked'}
                      </Text>
                    </View>
                  ) : (
                    // Show actual content when unlocked
                    <View style={styles.phaseHeader}>
                      <View style={styles.phaseHeaderContent}>
                        <Text style={styles.phaseTitle}>{phase.title}</Text>
                      </View>
                      <Text style={styles.phaseDescription}>{phase.description}</Text>
                    </View>
                  )}

                  {phaseUnlocked && !showSubscriptionBlur && phase.milestones.map((milestone, milestoneIndex) => {
                    const milestoneUnlocked = isMilestoneUnlocked(phaseIndex, milestoneIndex);
                    
                    // Show subscription blur for premium milestones
                    const isPremiumMilestone = (phaseIndex > 0 || milestoneIndex > 0) && shouldShowPaywallNow && !canAccessPremiumFeatures();
                    const showMilestoneSubscriptionBlur = isPremiumMilestone;
                    
                    return (
                      <View key={milestone.id} style={styles.milestoneCardContainer}>
                        <View style={[
                          styles.milestoneCard,
                          (!milestoneUnlocked || showMilestoneSubscriptionBlur) && styles.lockedMilestone
                        ]}>
                        {(!milestoneUnlocked || showMilestoneSubscriptionBlur) ? (
                          // Show only lock indicator when locked
                          <View style={styles.lockedMilestoneContent}>
                            <Lock size={24} color="#FFFFFF" />
                            <Text style={styles.milestoneLockText}>
                              {showMilestoneSubscriptionBlur ? 'Premium Content - Subscribe to Unlock' : 'Milestone Locked'}
                            </Text>
                          </View>
                        ) : (
                          // Show actual content when unlocked
                          <View style={styles.milestoneHeader}>
                            <View style={styles.milestoneHeaderContent}>
                              <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                            </View>
                            <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                          </View>
                        )}

                        {milestoneUnlocked && !showMilestoneSubscriptionBlur && (
                          <View style={styles.tasksContainer}>
                            {milestone.tasks.map((task, taskIndex) => {
                              const isCompleted = completedTasks.includes(task.id);
                              const taskUnlocked = isTaskUnlocked(phaseIndex, milestoneIndex, taskIndex);
                              
                              // Show subscription blur for premium tasks
                              const isPremiumTask = (phaseIndex > 0 || milestoneIndex > 0 || taskIndex > 2) && shouldShowPaywallNow && !canAccessPremiumFeatures();
                              const showTaskSubscriptionBlur = isPremiumTask;
                              
                              // On Android, hide tasks more aggressively if paywall should be shown
                              const shouldHideTask = Platform.OS === 'android' && 
                                                   shouldShowPaywallNow && 
                                                   (phaseIndex > 0 || milestoneIndex > 0 || taskIndex > 5) && // Allow more tasks to show with blur
                                                   !canAccessPremiumFeatures();
                              
                              if (shouldHideTask) {
                                return null;
                              }
                              
                              return (
                                <View key={task.id} style={styles.taskItemContainer}>
                                  <View style={styles.taskItem}>
                                    <View style={styles.taskContent}>
                                      {!taskUnlocked ? (
                                        <Lock size={16} color="#666666" />
                                      ) : (
                                        <Circle size={20} color="#666666" />
                                      )}
                                      <View style={styles.taskTextContainer}>
                                        <Text
                                          style={[
                                            styles.taskText,
                                            isCompleted && styles.taskTextCompleted,
                                            !taskUnlocked && styles.lockedText,
                                          ]}
                                        >
                                          {task.title}
                                        </Text>
                                        <Text style={styles.taskTime}>{task.estimatedTime}</Text>
                                      </View>
                                    </View>
                                    {taskUnlocked && (
                                      <TouchableOpacity
                                        style={[
                                          styles.taskButton,
                                          isCompleted && styles.taskButtonCompleted,
                                        ]}
                                        onPress={() => handleTaskAction(task.id, phaseIndex, milestoneIndex, taskIndex, task.estimatedTime)}
                                        accessibilityRole="button"
                                        testID={`task-button-${task.id}`}
                                      >
                                        {(() => {
                                          const buttonContent = getTaskButtonContent(task.id, task.estimatedTime);
                                          return (
                                            <View style={styles.taskButtonContent}>
                                              {buttonContent.icon}
                                              <Text style={[
                                                styles.taskButtonText,
                                                isCompleted && styles.taskButtonTextCompleted
                                              ]}>
                                                {buttonContent.text}
                                              </Text>
                                            </View>
                                          );
                                        })()} 
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                   {(!taskUnlocked || showTaskSubscriptionBlur) && (
                                     <View style={styles.taskBlurOverlay}>
                                       {Platform.OS === 'web' ? (
                                         <View style={styles.webTaskBlurOverlay}>
                                           <View style={styles.taskLockIndicator}>
                                             <Lock size={18} color="#FFFFFF" />
                                             <Text style={styles.taskLockText}>
                                               {showTaskSubscriptionBlur ? 'Premium' : 'Locked'}
                                             </Text>
                                           </View>
                                         </View>
                                       ) : Platform.OS === 'android' ? (
                                         <View style={styles.androidTaskBlurOverlay}>
                                           <View style={styles.taskLockIndicator}>
                                             <Lock size={18} color="#FFFFFF" />
                                             <Text style={styles.taskLockText}>
                                               {showTaskSubscriptionBlur ? 'Premium' : 'Locked'}
                                             </Text>
                                           </View>
                                         </View>
                                       ) : (
                                         <BlurView intensity={40} style={styles.nativeTaskBlurOverlay}>
                                           <View style={styles.taskLockIndicator}>
                                             <Lock size={18} color="#FFFFFF" />
                                             <Text style={styles.taskLockText}>
                                               {showTaskSubscriptionBlur ? 'Premium' : 'Locked'}
                                             </Text>
                                           </View>
                                         </BlurView>
                                       )}
                                     </View>
                                   )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                        </View>
                      </View>
                    );
                  })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          </Animated.View>
        </View>
      </LinearGradient>
      
      {/* Paywall Modal */}
      <Modal
        visible={showPaywallModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowPaywallModal(false);
          router.back(); // Go back to previous screen
        }}
      >
        <PaywallScreen
          onClose={() => {
            setShowPaywallModal(false);
            router.back(); // Go back to previous screen
          }}
          onSubscribe={() => {
            setShowPaywallModal(false);
            showToast('Welcome to Ambitionly Pro! 🚀', 'success');
          }}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    ...Platform.select({
      android: {
        paddingBottom: 20, // Extra bottom padding for Android
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#9A9A9A',
  },
  backButton: {
    padding: 8,
  },
  safeAreaBackground: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  phasesContainer: {
    flex: 1,
  },
  phaseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  phaseHeader: {
    marginBottom: 16,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  phaseDescription: {
    fontSize: 14,
    color: '#9A9A9A',
    lineHeight: 20,
  },
  milestoneCard: {
    backgroundColor: '#2D2D2D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  milestoneHeader: {
    marginBottom: 12,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#E0E0E0',
    marginBottom: 4,
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#9A9A9A',
    lineHeight: 18,
  },
  tasksContainer: {
    gap: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  taskTextContainer: {
    flex: 1,
  },
  taskText: {
    fontSize: 14,
    color: '#E0E0E0',
    lineHeight: 18,
    marginBottom: 2,
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through' as const,
    color: '#9A9A9A',
  },
  taskTime: {
    fontSize: 12,
    color: '#00E6E6',
    fontWeight: '600' as const,
  },
  taskButton: {
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E6E6',
  },
  taskButtonCompleted: {
    backgroundColor: '#1A4D3A',
    borderColor: '#32D583',
  },
  taskButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskButtonText: {
    fontSize: 12,
    color: '#00E6E6',
    fontWeight: '600' as const,
  },
  taskButtonTextCompleted: {
    color: '#32D583',
  },
  // Locked states
  lockedCard: {
    backgroundColor: '#0A0A0A',
    borderColor: 'rgba(139, 92, 246, 0.8)',
    borderWidth: 2,
  },
  lockedMilestone: {
    backgroundColor: '#0A0A0A',
    borderColor: 'rgba(139, 92, 246, 0.6)',
    borderWidth: 1,
  },
  lockedTask: {
    opacity: 0.4,
  },
  lockedText: {
    color: '#666666',
  },
  phaseHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockIcon: {
    marginLeft: 8,
  },
  // Container styles for blur overlays
  phaseCardContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  milestoneCardContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  taskItemContainer: {
    position: 'relative',
  },
  // Locked content styles
  lockedPhaseContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  lockedMilestoneContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  // Blur overlay styles
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999, // Maximum z-index to ensure it's on top
    borderRadius: 16,
    elevation: 999, // Maximum Android elevation for proper layering
  },
  nativeBlurOverlay: {
    flex: 1,
    borderRadius: 16,
  },
  androidBlurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000', // Completely black background
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100, // Very high z-index
    elevation: 100, // Very high elevation for Android
  },
  webBlurOverlay: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Very dark background to block text
    backdropFilter: 'blur(20px)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskBlurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999, // Maximum z-index to ensure it's on top
    borderRadius: 8,
    elevation: 999, // Maximum Android elevation for proper layering
  },
  nativeTaskBlurOverlay: {
    flex: 1,
    borderRadius: 8,
  },
  androidTaskBlurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000', // Completely black background
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100, // Very high z-index
    elevation: 100, // Very high elevation for Android
  },
  webTaskBlurOverlay: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Very dark background to block text
    backdropFilter: 'blur(12px)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Lock indicator styles
  lockIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  taskLockIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  phaseLockText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: '#8B5CF6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  milestoneLockText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    textShadowColor: '#8B5CF6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  taskLockText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: '#8B5CF6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
});