import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Bell, Palette, Info, RefreshCw, Trash2, Code, ChevronRight, Crown, LogOut } from 'lucide-react-native';
import { useAmbition } from '@/hooks/ambition-store';
import { useSubscription } from '@/hooks/subscription-store';
import { useUser } from '@/hooks/user-store';
import { router } from 'expo-router';
import { useUi } from '@/providers/UiProvider';

export default function SettingsScreen() {
  const { clearAllData, resetProgress } = useAmbition();
  const { subscriptionState, isSubscriptionActive, cancelSubscription, restoreSubscription } = useSubscription();
  const { user, signOut } = useUser();
  const { showToast } = useUi();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(true);

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

  const handleResetProgress = () => {
    Alert.alert(
      'Reset Progress',
      'Are you sure you want to reset all your progress? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetProgress();
              showToast('Progress has been reset', 'success');
            } catch {
              showToast('Could not reset progress. Please try again.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleStartOver = () => {
    Alert.alert(
      'Start Over',
      'This will clear all your data and take you back to the beginning. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              router.replace('/welcome');
            } catch {
              showToast('Could not start over. Please try again.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleDevSettings = () => {
    router.push('/dev-settings');
  };

  const handleManageSubscription = () => {
    if (isSubscriptionActive()) {
      Alert.alert(
        'Manage Subscription',
        'To cancel or modify your subscription, please go to your device\'s App Store settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Cancel Subscription',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelSubscription();
                showToast('Subscription cancelled', 'success');
              } catch {
                showToast('Failed to cancel subscription', 'error');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Restore Subscription',
        'Restore your previous purchases if you have an active subscription.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              try {
                const restored = await restoreSubscription();
                if (restored) {
                  showToast('Subscription restored!', 'success');
                } else {
                  showToast('No active subscription found', 'warning');
                }
              } catch {
                showToast('Failed to restore subscription', 'error');
              }
            },
          },
        ]
      );
    }
  };

  const getSubscriptionDisplayText = () => {
    if (!isSubscriptionActive()) {
      return 'Free Plan';
    }
    
    const plan = subscriptionState.plan;
    switch (plan) {
      case 'monthly':
        return 'Monthly Pro';
      case 'annual':
        return 'Annual Pro';
      case 'lifetime':
        return 'Lifetime Pro';
      default:
        return 'Free Plan';
    }
  };

  const getSubscriptionSubtitle = () => {
    if (!isSubscriptionActive()) {
      return 'Upgrade to unlock all features';
    }
    
    if (subscriptionState.expiresAt) {
      const expiryDate = subscriptionState.expiresAt.toLocaleDateString();
      return `Active until ${expiryDate}`;
    }
    
    return 'Active';
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement, 
    destructive = false,
    showChevron = false 
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, destructive && styles.settingIconDestructive]}>
          {icon}
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, destructive && styles.settingTitleDestructive]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      {rightElement && (
        <View style={styles.settingRight}>
          {rightElement}
        </View>
      )}
      {showChevron && !rightElement && (
        <View style={styles.settingRight}>
          <ChevronRight size={20} color="#666666" />
        </View>
      )}
    </TouchableOpacity>
  );

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
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Customize your experience</Text>
          </View>

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {/* Subscription Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscription</Text>
              <View style={styles.sectionCard}>
                <SettingItem
                  icon={<Crown size={20} color={isSubscriptionActive() ? '#FFD700' : '#00E6E6'} />}
                  title={getSubscriptionDisplayText()}
                  subtitle={getSubscriptionSubtitle()}
                  onPress={handleManageSubscription}
                  showChevron
                />
              </View>
            </View>

            {/* Profile Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile</Text>
              <View style={styles.sectionCard}>
                <SettingItem
                  icon={<User size={20} color="#00E6E6" />}
                  title="Account"
                  subtitle="Manage your account settings"
                  onPress={() => {
                    router.push('/(main)/account');
                  }}
                  showChevron
                />
                {user && (
                  <SettingItem
                    icon={<LogOut size={20} color="#FF6B6B" />}
                    title="Sign Out"
                    subtitle="Sign out of your account"
                    onPress={() => {
                      Alert.alert(
                        'Sign Out',
                        'Are you sure you want to sign out?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Sign Out',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await signOut();
                                showToast('Signed out successfully', 'success');
                                router.replace('/welcome');
                              } catch {
                                showToast('Failed to sign out', 'error');
                              }
                            },
                          },
                        ]
                      );
                    }}
                    destructive={true}
                  />
                )}
              </View>
            </View>

            {/* Preferences Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preferences</Text>
              <View style={styles.sectionCard}>
                <SettingItem
                  icon={<Bell size={20} color="#00E6E6" />}
                  title="Notifications"
                  subtitle="Daily reminders and progress updates"
                  rightElement={
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={setNotificationsEnabled}
                      trackColor={{ false: '#2D2D2D', true: '#00E6E6' }}
                      thumbColor={notificationsEnabled ? '#FFFFFF' : '#666666'}
                    />
                  }
                />
                <SettingItem
                  icon={<Palette size={20} color="#00E6E6" />}
                  title="Dark Mode"
                  subtitle="Always enabled for the best experience"
                  rightElement={
                    <Switch
                      value={darkModeEnabled}
                      onValueChange={setDarkModeEnabled}
                      trackColor={{ false: '#2D2D2D', true: '#00E6E6' }}
                      thumbColor={darkModeEnabled ? '#FFFFFF' : '#666666'}
                      disabled={true}
                    />
                  }
                />
              </View>
            </View>

            {/* Progress Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress</Text>
              <View style={styles.sectionCard}>
                <SettingItem
                  icon={<RefreshCw size={20} color="#FF6B6B" />}
                  title="Reset Progress"
                  subtitle="Clear completed tasks but keep your roadmap"
                  onPress={handleResetProgress}
                  destructive={true}
                />
                <SettingItem
                  icon={<Trash2 size={20} color="#FF6B6B" />}
                  title="Start Over"
                  subtitle="Clear everything and create a new roadmap"
                  onPress={handleStartOver}
                  destructive={true}
                />
              </View>
            </View>

            {/* About Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.sectionCard}>
                <SettingItem
                  icon={<Info size={20} color="#00E6E6" />}
                  title="About Ambitionly"
                  subtitle="Version 1.0.0"
                  onPress={() => {
                    Alert.alert(
                      'About Ambitionly',
                      'Ambitionly helps you transform your ambitions into actionable roadmaps. Built with AI to provide personalized guidance on your journey to success.\n\nSlogan: "Actionize Your Ambitions"'
                    );
                  }}
                  showChevron
                />
                {__DEV__ && (
                  <SettingItem
                    icon={<Code size={20} color="#00E6E6" />}
                    title="Developer Settings"
                    subtitle="Debug tools and diagnostics"
                    onPress={handleDevSettings}
                    showChevron
                  />
                )}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Made with ❤️ for ambitious people
              </Text>
              <Text style={styles.footerSubtext}>
                Actionize Your Ambitions
              </Text>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9A9A9A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D2D',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2D2D2D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIconDestructive: {
    backgroundColor: '#FF6B6B20',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingTitleDestructive: {
    color: '#FF6B6B',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    lineHeight: 18,
  },
  settingRight: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});