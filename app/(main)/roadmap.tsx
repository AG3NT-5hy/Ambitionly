import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform, Modal, ActivityIndicator, BackHandler } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, Flame, ChevronRight, Play, Clock, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAmbition, type Task } from '@/hooks/ambition-store';
import { useSubscription } from '@/hooks/subscription-store';
import { useUnifiedUser } from '@/lib/unified-user-store';
import { useUi } from '@/providers/UiProvider';
import { SkeletonBlock } from '@/components/Skeleton';
import { router, useFocusEffect } from 'expo-router';
import PaywallScreen from '@/components/PaywallScreen';
import SignUpScreen from '@/components/SignUpScreen';

export default function RoadmapScreen() {
  const { 
    goal, 
    roadmap, 
    completedTasks, 
    toggleTask, 
    startTaskTimer,
    getTaskTimer,
    isTaskTimerComplete,
    getTaskTimerProgress,
    getProgress, 
    getStreak, 
    isTaskUnlocked 
  } = useAmbition();

  // Debug completedTasks changes
  useEffect(() => {
    console.log('[Roadmap] completedTasks changed:', completedTasks);
  }, [completedTasks]);

  // Debug roadmap changes
  useEffect(() => {
    console.log('[Roadmap] roadmap changed:', {
      hasRoadmap: !!roadmap,
      phasesCount: roadmap?.phases?.length,
      roadmapId: roadmap?.id
    });
  }, [roadmap]);
  const { shouldShowPaywall } = useSubscription();
  const { isRegistered, signUp, signIn, signInWithGoogle } = useUnifiedUser();
  const { showToast } = useUi();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);
  const [paywallDismissed, setPaywallDismissed] = useState<boolean>(false);
  const [showSignUpModal, setShowSignUpModal] = useState<boolean>(false);
  const shouldShowSignUp = !isRegistered;
  const [hasCheckedSignUp, setHasCheckedSignUp] = useState<boolean>(false);
  const [startingTimer, setStartingTimer] = useState<string | null>(null);
  const lastBackPressRef = useRef<number>(0);
  
  // Track the current task to prevent unexpected changes
  const currentTaskRef = useRef<Task | null>(null);
  const [stableTask, setStableTask] = useState<Task | null>(null);

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

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reset sign-up check and paywall when user registration status changes
  useEffect(() => {
    setHasCheckedSignUp(false);
    setPaywallDismissed(false);
  }, [isRegistered]);

  const progress = getProgress();
  const streak = getStreak();
  const shouldShowPaywallNow = shouldShowPaywall(completedTasks.length);

  const handleGoogleSignup = useCallback(async () => {
    try {
      const success = await signInWithGoogle();
      if (!success) {
        return false;
      }

      setShowSignUpModal(false);
      showToast('Welcome! Your progress is now saved.', 'success');

      if (shouldShowPaywallNow && !paywallDismissed) {
        setTimeout(() => {
          setShowPaywallModal(true);
        }, 500);
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign up failed';
      showToast(message, 'error');
      throw new Error(message);
    }
  }, [signInWithGoogle, showToast, shouldShowPaywallNow, paywallDismissed]);

  const handleGoogleSignin = useCallback(async () => {
    try {
      const success = await signInWithGoogle();
      if (!success) {
        return false;
      }

      setShowSignUpModal(false);
      showToast('Welcome back! Your data has been synced.', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign in failed';
      showToast(message, 'error');
      throw new Error(message);
    }
  }, [signInWithGoogle, showToast]);

  // Show sign-up modal on first visit if user hasn't signed up
  useEffect(() => {
    if (!hasCheckedSignUp && roadmap) {
      setHasCheckedSignUp(true);
      if (!isRegistered) {
        setShowSignUpModal(true);
      }
    }
  }, [hasCheckedSignUp, roadmap, isRegistered]);

  // Show paywall when triggered
  useEffect(() => {
    if (shouldShowPaywallNow && !paywallDismissed && !showSignUpModal) {
      setShowPaywallModal(true);
    }
  }, [shouldShowPaywallNow, paywallDismissed, showSignUpModal]);

  // Prevent navigating back to onboarding/history from the roadmap screen on Android
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return () => {};
      }

      const onBackPress = () => {
        // Close any open modal first
        if (showPaywallModal) {
          setShowPaywallModal(false);
          return true;
        }

        if (showSignUpModal) {
          setShowSignUpModal(false);
          return true;
        }

        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPressRef.current = now;
        showToast('Press back again to exit', 'info');
        return true; // Block default behavior (going back to onboarding)
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [showPaywallModal, showSignUpModal, showToast])
  );



  const getTodaysTask = useCallback(() => {
    console.log('[Roadmap] getTodaysTask called');
    console.log('[Roadmap] Dependencies:', {
      roadmapPhases: roadmap?.phases?.length,
      completedTasksCount: completedTasks.length,
      completedTasks: completedTasks
    });
    
    if (!roadmap?.phases) {
      console.log('[Roadmap] No roadmap phases available');
      return null;
    }
    
    // Find the first unlocked, incomplete task in natural roadmap order
    for (let phaseIndex = 0; phaseIndex < roadmap.phases.length; phaseIndex++) {
      const phase = roadmap.phases[phaseIndex];
      if (!phase?.milestones) continue;
      for (let milestoneIndex = 0; milestoneIndex < phase.milestones.length; milestoneIndex++) {
        const milestone = phase.milestones[milestoneIndex];
        if (!milestone?.tasks) continue;
        for (let taskIndex = 0; taskIndex < milestone.tasks.length; taskIndex++) {
          const task = milestone.tasks[taskIndex];
          if (!task) continue;
          
          const isCompleted = completedTasks.includes(task.id);
          const isUnlocked = isTaskUnlocked(phaseIndex, milestoneIndex, taskIndex);
          
          console.log(`[Roadmap] Checking task: ${task.title}`, {
            taskId: task.id,
            isCompleted,
            isUnlocked,
            phaseIndex,
            milestoneIndex,
            taskIndex
          });
          
          // Return the first task that is not completed and is unlocked
          if (!isCompleted && isUnlocked) {
            console.log(`[Roadmap] Selected task: ${task.title} (${task.id})`);
            return task;
          }
        }
      }
    }
    
    console.log('[Roadmap] No available tasks found');
    return null; // All tasks completed
  }, [roadmap?.phases, completedTasks, isTaskUnlocked]);

  const todaysTask = useMemo(() => {
    console.log('[Roadmap] todaysTask useMemo triggered');
    const task = getTodaysTask();
    
    // Only update the stable task if it's actually different
    if (task && (!currentTaskRef.current || currentTaskRef.current.id !== task.id)) {
      console.log(`[Roadmap] Task changed from ${currentTaskRef.current?.id} to ${task.id}`);
      currentTaskRef.current = task;
      setStableTask(task);
    } else if (!task && currentTaskRef.current) {
      console.log('[Roadmap] Task cleared');
      currentTaskRef.current = null;
      setStableTask(null);
    }
    
    if (task) {
      console.log(`[Roadmap] Today's task:`, {
        id: task.id,
        title: task.title,
        estimatedTime: task.estimatedTime,
        description: task.description
      });
    } else {
      console.log('[Roadmap] No task selected');
    }
    return task;
  }, [getTodaysTask]);

  // Use stable task for display to prevent glitching
  const displayTask = stableTask || todaysTask;

  const handleStartTimer = useCallback(async (taskId: string, estimatedTime: string) => {
    // Prevent multiple simultaneous starts
    if (startingTimer === taskId) {
      console.log('[Roadmap] Timer already starting for this task, ignoring duplicate click');
      return;
    }
    
    if (!estimatedTime?.trim()) {
      console.warn('Invalid estimated time provided');
      return;
    }
    
    const sanitizedTime = estimatedTime.trim().slice(0, 20);
    
    try {
      setStartingTimer(taskId);
      console.log(`[Roadmap] Starting timer for task ${taskId} with time: ${sanitizedTime}`);
      await startTaskTimer(taskId, sanitizedTime);
      console.log(`[Roadmap] Timer started successfully`);
    } catch (error) {
      console.error('[Roadmap] Error starting timer:', error);
      showToast('Failed to start timer. Please try again.', 'error');
    } finally {
      // Small delay to prevent rapid re-clicks
      setTimeout(() => {
        setStartingTimer(null);
      }, 500);
    }
  }, [startTaskTimer, startingTimer, showToast]);

  const handleTaskToggle = useCallback(async (taskId: string) => {
    try {
      // Find the task indices to validate it's unlocked
      let canToggle = false;
      
      if (roadmap?.phases) {
        for (let phaseIndex = 0; phaseIndex < roadmap.phases.length; phaseIndex++) {
          const phase = roadmap.phases[phaseIndex];
          if (!phase?.milestones) continue;
          for (let milestoneIndex = 0; milestoneIndex < phase.milestones.length; milestoneIndex++) {
            const milestone = phase.milestones[milestoneIndex];
            if (!milestone?.tasks) continue;
            for (let taskIndex = 0; taskIndex < milestone.tasks.length; taskIndex++) {
              const task = milestone.tasks[taskIndex];
              if (!task) continue;
              if (task.id === taskId && isTaskUnlocked(phaseIndex, milestoneIndex, taskIndex)) {
                canToggle = true;
                break;
              }
            }
            if (canToggle) break;
          }
          if (canToggle) break;
        }
      }
      
      if (canToggle) {
        const success = await toggleTask(taskId);
        
        if (!success) {
          // Timer is still running
          console.log('Timer still running - task cannot be completed yet');
          
          // Web-compatible user feedback
          if (Platform.OS === 'web') {
            // Could show a toast notification here
            console.warn('Please complete the timer before marking this task as done');
            showToast('Please complete the timer before marking this task as done', 'warning');
          }
          return;
        }
        
        // Task completed successfully
        if (!completedTasks.includes(taskId)) {
          console.log('Task completed successfully!');
          try {
            if (Platform.OS !== 'web') {
              const Haptics = await import('expo-haptics');
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (e) {
            console.warn('Haptics not available:', e);
          }
          showToast('Nice! Step completed.', 'success');
        }
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  }, [roadmap?.phases, isTaskUnlocked, toggleTask, completedTasks, showToast]);

  const formatTimeRemaining = useCallback((elapsed: number, total: number): string => {
    const remaining = Math.max(0, total - elapsed);
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    console.log(`[Timer Display] Elapsed: ${elapsed}ms, Total: ${total}ms, Remaining: ${remaining}ms, Display: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const renderTaskTimer = useCallback((taskId: string) => {
    const timer = getTaskTimer(taskId);
    
    if (!timer || timer.isCompleted || !timer.isActive) return null;
    
    // Get fresh progress data using current time - currentTime dependency ensures smooth updates
    const progress = getTaskTimerProgress(taskId);
    const isTimerComplete = isTaskTimerComplete(taskId);
    
    return (
      <View style={styles.timerContainer}>
        <View style={styles.timerProgress}>
          <View style={[styles.timerProgressBar, { width: `${progress.percentage}%` }]} />
        </View>
        <View style={styles.timerInfo}>
          <Clock size={16} color={isTimerComplete ? '#32D583' : '#00E6E6'} />
          <Text style={[styles.timerText, { color: isTimerComplete ? '#32D583' : '#00E6E6' }]}>
            {isTimerComplete ? 'Time Complete!' : formatTimeRemaining(progress.elapsed, progress.total)}
          </Text>
        </View>
      </View>
    );
  }, [getTaskTimer, getTaskTimerProgress, isTaskTimerComplete, formatTimeRemaining, currentTime]);

  if (!roadmap) {
    return (
      <LinearGradient colors={['#000000', '#29202B']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your roadmap...</Text>
          <View style={styles.loadingCard}>
            <SkeletonBlock lines={1} lineHeight={24} />
            <View style={styles.loadingGrid}>
              <SkeletonBlock lines={3} />
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#000000', '#29202B']} style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}

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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Roadmap</Text>
            <Text style={styles.headerSubtitle}>{goal}</Text>
          </View>

          {/* Progress Ring */}
          <View style={styles.progressSection}>
            <View style={styles.progressRing}>
              <LinearGradient
                colors={['#6C63FF', '#3DBEFF', '#00E6E6']}
                style={styles.progressGradient}
              >
                <View style={styles.progressInner}>
                  <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
                  <Text style={styles.progressLabel}>Complete</Text>
                </View>
              </LinearGradient>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Flame size={20} color="#FF6B6B" />
                <Text style={styles.statValue}>{streak}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
              <View style={styles.statItem}>
                <Target size={20} color="#32D583" />
                <Text style={styles.statValue}>{completedTasks.length}</Text>
                <Text style={styles.statLabel}>Tasks Done</Text>
              </View>
            </View>
          </View>

          {/* Today's Task or Paywall Prompt */}
          {todaysTask && !shouldShowPaywallNow && (
            <View style={styles.todaySection}>
              <LinearGradient
                colors={['#6C63FF', '#3DBEFF', '#00E6E6']}
                style={styles.todayGradient}
              >
                <View style={styles.todayContent} testID="next-step-card">
                  <Text style={styles.todayTitle}>Next Step</Text>
                  <Text style={styles.todayTask} testID="next-step-title">{todaysTask.title}</Text>
                  {todaysTask.description ? (
                    <Text style={styles.todayDescription} testID="next-step-description">{todaysTask.description}</Text>
                  ) : null}
                  {todaysTask.estimatedTime ? (
                    <View style={styles.timePill} testID="next-step-time">
                      <Text style={styles.timePillText}>{todaysTask.estimatedTime}</Text>
                    </View>
                  ) : null}
                  
                  {renderTaskTimer(todaysTask.id)}
                  
                  {(() => {
                    const timer = getTaskTimer(todaysTask.id);
                    const isTimerActive = timer && timer.isActive;
                    const isTimerComplete = isTaskTimerComplete(todaysTask.id);
                    const isCompleted = completedTasks.includes(todaysTask.id);
                    
                    if (isCompleted) {
                      return (
                        <View style={[styles.todayButton, styles.completedButton]}>
                          <Text style={styles.completedButtonText}>✓ Completed</Text>
                        </View>
                      );
                    }
                    
                    if (!isTimerActive) {
                      const isStarting = startingTimer === todaysTask.id;
                      return (
                        <TouchableOpacity
                          style={[styles.startTimerButton, isStarting && styles.startTimerButtonDisabled]}
                          onPress={() => {
                            if (isStarting) return; // Prevent multiple clicks
                            const timeToUse = todaysTask.estimatedTime || '20 min';
                            console.log(`[Roadmap] Starting timer with time: "${timeToUse}" (original: "${todaysTask.estimatedTime}")`);
                            handleStartTimer(todaysTask.id, timeToUse);
                          }}
                          disabled={isStarting}
                          accessibilityLabel="Start task timer"
                          testID="start-timer"
                        >
                          {isStarting ? (
                            <>
                              <ActivityIndicator size="small" color="#FFFFFF" />
                              <Text style={styles.startTimerButtonText}>Starting...</Text>
                            </>
                          ) : (
                            <>
                              <Play size={16} color="#FFFFFF" />
                              <Text style={styles.startTimerButtonText}>Start Task</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    }
                    
                    return (
                      <TouchableOpacity
                        style={[
                          styles.todayButton,
                          !isTimerComplete && styles.disabledButton
                        ]}
                        onPress={() => handleTaskToggle(todaysTask.id)}
                        disabled={!isTimerComplete}
                        accessibilityLabel={isTimerComplete ? "Mark next step complete" : "Timer still running"}
                        testID="next-step-complete"
                      >
                        <Text style={[
                          styles.todayButtonText,
                          !isTimerComplete && styles.disabledButtonText
                        ]}>
                          {isTimerComplete ? 'Mark Complete' : 'Complete Timer First'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Paywall Prompt Card */}
          {shouldShowPaywallNow && (
            <View style={styles.paywallSection}>
              <LinearGradient
                colors={['#6C63FF', '#3DBEFF', '#00E6E6']}
                style={styles.paywallGradient}
              >
                <View style={styles.paywallContent}>
                  <Lock size={32} color="#FFFFFF" style={styles.paywallIcon} />
                  <Text style={styles.paywallTitle}>Great Progress! 🎉</Text>
                  <Text style={styles.paywallDescription}>
                    You&apos;ve made the First Step towards your Ambition! Subscribe to a plan to Continue your Journey.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.paywallButton}
                    onPress={() => {
                      setShowPaywallModal(true);
                      setPaywallDismissed(false); // Allow modal to show again when user explicitly requests it
                    }}
                    accessibilityLabel="Unlock premium features"
                  >
                    <Text style={styles.paywallButtonText}>Unlock Full Access</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* View All Phases Button */}
          <TouchableOpacity 
            style={[
              styles.viewAllButton,
              shouldShowPaywallNow && styles.lockedButton
            ]}
            onPress={() => {
              if (shouldShowPaywallNow) {
                setShowPaywallModal(true);
                setPaywallDismissed(false); // Allow modal to show again when user explicitly requests it
              } else {
                router.push('/phases');
              }
            }}
          >
            {shouldShowPaywallNow ? (
              <>
                <Lock size={20} color="#666666" />
                <Text style={styles.lockedButtonText}>Unlock to View All Phases</Text>
              </>
            ) : (
              <>
                <Text style={styles.viewAllButtonText}>View All Phases</Text>
                <ChevronRight size={20} color="#00E6E6" />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Paywall Modal */}
      <Modal
        visible={showPaywallModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPaywallModal(false)}
      >
        <PaywallScreen
          onClose={() => {
            setShowPaywallModal(false);
            setPaywallDismissed(true);
          }}
          onSubscribe={() => {
            setShowPaywallModal(false);
            setPaywallDismissed(false);
            showToast('Welcome to Ambitionly Pro! 🚀', 'success');
          }}
          onShowSignUp={() => {
            setShowPaywallModal(false);
            setShowSignUpModal(true);
          }}
        />
      </Modal>

      {/* Sign Up Modal */}
      <Modal
        visible={showSignUpModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSignUpModal(false)}
      >
        <SignUpScreen
          onClose={() => {
            setShowSignUpModal(false);
          }}
          onSignUp={async (email: string, password: string, name: string, username?: string) => {
            try {
              await signUp(email, password, name);
              setShowSignUpModal(false);
              showToast('Welcome! Your progress is now saved.', 'success');
              
              // After sign up, show paywall if needed
              if (shouldShowPaywallNow && !paywallDismissed) {
                setTimeout(() => {
                  setShowPaywallModal(true);
                }, 500);
              }
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Sign up failed', 'error');
              throw error;
            }
          }}
          onSignIn={async (email: string, password: string) => {
            try {
              await signIn(email, password);
              setShowSignUpModal(false);
              showToast('Welcome back! Your data has been synced.', 'success');
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Sign in failed', 'error');
              throw error;
            }
          }}
          onSignUpWithGoogle={handleGoogleSignup}
          onSignInWithGoogle={handleGoogleSignin}
        />
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 20,
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
  loadingCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    width: '90%',
  },
  loadingGrid: {
    marginTop: 12,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center' as const,
    paddingHorizontal: 20,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  progressRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 4,
    marginBottom: 24,
  },
  progressGradient: {
    flex: 1,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
  },
  progressLabel: {
    fontSize: 12,
    color: '#9A9A9A',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 40,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#9A9A9A',
  },
  todaySection: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
  },
  todayGradient: {
    padding: 1,
  },
  todayContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 19,
    padding: 32,
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
  },
  todayTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#00E6E6',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  todayTask: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginBottom: 12,
    lineHeight: 28,
  },
  todayDescription: {
    fontSize: 16,
    color: '#B3B3B3',
    textAlign: 'center' as const,
    marginBottom: 16,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  timePill: {
    backgroundColor: '#0F2A2A',
    borderColor: '#00E6E6',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 20,
  },
  timePillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  timerContainer: {
    width: '100%',
    marginBottom: 20,
  },
  timerProgress: {
    height: 4,
    backgroundColor: '#2D2D2D',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timerProgressBar: {
    height: '100%',
    backgroundColor: '#00E6E6',
    borderRadius: 2,
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  startTimerButton: {
    backgroundColor: '#00E6E6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startTimerButtonDisabled: {
    opacity: 0.6,
  },
  startTimerButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  disabledButtonText: {
    color: '#666666',
  },
  completedButton: {
    backgroundColor: '#32D583',
  },
  completedButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  todayButton: {
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
  todayButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#00E6E6',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 8,
  },
  viewAllButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  paywallSection: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
  },
  paywallGradient: {
    padding: 1,
  },
  paywallContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 19,
    padding: 32,
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
  },
  paywallIcon: {
    marginBottom: 16,
  },
  paywallTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  paywallDescription: {
    fontSize: 16,
    color: '#B3B3B3',
    textAlign: 'center' as const,
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  paywallButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  paywallButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  lockedButton: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333333',
    opacity: 0.7,
  },
  lockedButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#666666',
  },
});
