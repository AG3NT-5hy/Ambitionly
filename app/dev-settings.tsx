import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Download, Trash2, Bug, Settings, Lock, Eye, EyeOff, Mail, RefreshCw, Filter, Crown } from 'lucide-react-native';
import { COLORS } from '../constants'
import { debugService, log, type DebugInfo } from '../lib/debug'
import { analytics } from '../lib/analytics'
import { useAmbition } from '../hooks/ambition-store'
import EmailViewerFallback from '@/components/EmailViewerFallback'
import { trpc } from '../lib/trpc'

// Developer credentials - in production, these should be stored securely
const DEV_USERNAME = 'ag3nt';
const DEV_PASSWORD = 'fuckyouu';

const DevSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [showEmailViewer, setShowEmailViewer] = useState(false);
  const [logs, setLogs] = useState(debugService.getLogs(undefined, undefined, 200));
  const [logLevelFilter, setLogLevelFilter] = useState<'debug' | 'info' | 'warn' | 'error' | undefined>(undefined);
  const { clearAllData, resetProgress } = useAmbition();
  
  // Premium access grant state
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState<'monthly' | 'annual' | 'lifetime'>('monthly');
  const [showGrantPremium, setShowGrantPremium] = useState(false);
  const grantPremiumMutation = trpc.admin.users.grantPremium.useMutation();

  const refreshLogs = useCallback((level?: 'debug' | 'info' | 'warn' | 'error') => {
    const next = debugService.getLogs(level, undefined, 200);
    setLogs(next);
    setLogLevelFilter(level);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDebugInfo();
      setOfflineMode(debugService.getOfflineMode());
      refreshLogs();
    }
  }, [isAuthenticated, refreshLogs]);

  // Auto-refresh logs every 2 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      refreshLogs(logLevelFilter);
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, logLevelFilter, refreshLogs]);

  const handleLogin = () => {
    setLoginError('');
    
    if (username.trim() === DEV_USERNAME && password === DEV_PASSWORD) {
      setIsAuthenticated(true);
      log.info('DevSettings', 'Developer authenticated successfully');
      analytics.track('dev_settings_accessed');
    } else {
      setLoginError('Invalid username or password');
      log.warn('DevSettings', 'Failed authentication attempt', { username: username.trim() });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setLoginError('');
    setDebugInfo(null);
    setIsLoading(true);
    log.info('DevSettings', 'Developer logged out');
  };

  const loadDebugInfo = async () => {
    try {
      setIsLoading(true);
      const info = await debugService.getDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      log.error('DevSettings', 'Failed to load debug info', error);
      Alert.alert('Error', 'Failed to load debug information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOffline = () => {
    debugService.toggleOfflineMode();
    const newMode = debugService.getOfflineMode();
    setOfflineMode(newMode);
    log.info('DevSettings', `Offline mode toggled: ${newMode}`);
  };

  const handleToggleAnalytics = () => {
    const newEnabled = !analyticsEnabled;
    setAnalyticsEnabled(newEnabled);
    analytics.setEnabled(newEnabled);
    log.info('DevSettings', `Analytics toggled: ${newEnabled}`);
  };

  const handleExportLogs = async () => {
    try {
      const logs = debugService.exportLogs();
      
      if (Platform.OS === 'web') {
        // For web, create a download link
        const blob = new Blob([logs], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For mobile, use Share API
        await Share.share({
          message: logs,
          title: 'Debug Logs Export',
        });
      }
      
      log.info('DevSettings', 'Logs exported successfully');
    } catch (error) {
      log.error('DevSettings', 'Failed to export logs', error);
      Alert.alert('Error', 'Failed to export logs');
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all debug logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            debugService.clearLogs();
            log.info('DevSettings', 'Debug logs cleared');
            loadDebugInfo();
          },
        },
      ]
    );
  };

  const handleResetProgress = () => {
    Alert.alert(
      'Reset Progress',
      'This will clear all completed tasks, timers, and streak data. Your roadmap will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetProgress();
            log.info('DevSettings', 'Progress reset');
            Alert.alert('Success', 'Progress has been reset');
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your data including goals, roadmaps, and progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            log.info('DevSettings', 'All data cleared');
            Alert.alert('Success', 'All data has been cleared');
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleTestCrash = () => {
    Alert.alert(
      'Test Crash',
      'This will intentionally crash the app to test error reporting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash',
          style: 'destructive',
          onPress: () => {
            log.error('DevSettings', 'Intentional crash test');
            throw new Error('Test crash from dev settings');
          },
        },
      ]
    );
  };

  const handleViewEmails = () => {
    setShowEmailViewer(true);
    log.info('DevSettings', 'Email viewer accessed');
  };

  const handleGrantPremium = async () => {
    if (!grantEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(grantEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      const result = await grantPremiumMutation.mutateAsync({
        email: grantEmail.trim(),
        plan: grantPlan,
      });

      if (result.success) {
        Alert.alert(
          'Success',
          `Premium ${grantPlan} plan granted to ${grantEmail.trim()}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setGrantEmail('');
                setShowGrantPremium(false);
              },
            },
          ]
        );
        log.info('DevSettings', `Premium access granted to ${grantEmail.trim()}`, { plan: grantPlan });
        analytics.track('admin_premium_granted', { plan: grantPlan });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to grant premium access';
      Alert.alert('Error', errorMessage);
      log.error('DevSettings', 'Failed to grant premium access', error);
    }
  };

  const renderInfoSection = (title: string, data: any) => {
    if (!data || typeof data !== 'object') return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.infoContainer}>
          {Object.entries(data).map(([key, value]) => (
            <View key={key} style={styles.infoRow}>
              <Text style={styles.infoKey}>{key}:</Text>
              <Text style={styles.infoValue}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderToggleSection = (title: string, value: boolean, onToggle: () => void, description?: string) => {
    return (
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {description && <Text style={styles.description}>{description}</Text>}
          </View>
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
            thumbColor={value ? COLORS.TEXT_PRIMARY : COLORS.TEXT_MUTED}
          />
        </View>
      </View>
    );
  };

  const renderActionButton = (title: string, onPress: () => void, icon: React.ReactNode, destructive = false) => {
    return (
      <TouchableOpacity
        style={[styles.actionButton, destructive && styles.destructiveButton]}
        onPress={onPress}
      >
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <Text style={[styles.actionButtonText, destructive && styles.destructiveText]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <KeyboardAvoidingView 
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Stack.Screen
          options={{
            title: 'Developer Access',
            headerShown: true,
            headerStyle: { backgroundColor: COLORS.BACKGROUND },
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronLeft size={24} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            ),
          }}
        />
        
        <View style={styles.loginContainer}>
          <View style={styles.loginHeader}>
            <View style={styles.lockIconContainer}>
              <Lock size={48} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.loginTitle}>Developer Access</Text>
            <Text style={styles.loginSubtitle}>Enter credentials to access developer settings</Text>
          </View>
          
          <View style={styles.loginForm}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setLoginError('');
                }}
                placeholder="Enter username"
                placeholderTextColor={COLORS.TEXT_MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                testID="dev-username-input"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.textInput, styles.passwordInput]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setLoginError('');
                  }}
                  placeholder="Enter password"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="dev-password-input"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  testID="toggle-password-visibility"
                >
                  {showPassword ? (
                    <EyeOff size={20} color={COLORS.TEXT_MUTED} />
                  ) : (
                    <Eye size={20} color={COLORS.TEXT_MUTED} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            
            {loginError ? (
              <Text style={styles.errorText}>{loginError}</Text>
            ) : null}
            
            <TouchableOpacity
              style={[styles.loginButton, (!username.trim() || !password) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={!username.trim() || !password}
              testID="dev-login-button"
            >
              <Text style={[styles.loginButtonText, (!username.trim() || !password) && styles.loginButtonTextDisabled]}>
                Access Developer Settings
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.loginFooter}>
            <Text style={styles.loginFooterText}>Restricted Access</Text>
            <Text style={styles.loginFooterSubtext}>Only authorized developers can access these settings</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Developer Settings',
            headerShown: true,
            headerStyle: { backgroundColor: COLORS.BACKGROUND },
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronLeft size={24} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading debug information...</Text>
        </View>
      </View>
    );
  }

  // Email viewer screen
  if (showEmailViewer) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Collected Emails',
            headerShown: true,
            headerStyle: { backgroundColor: COLORS.BACKGROUND },
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerLeft: () => (
              <TouchableOpacity onPress={() => setShowEmailViewer(false)} style={styles.backButton}>
                <ChevronLeft size={24} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            ),
          }}
        />
        <EmailViewerFallback />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          title: 'Developer Settings',
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.BACKGROUND },
          headerTintColor: COLORS.TEXT_PRIMARY,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* App Info */}
        {debugInfo && renderInfoSection('App Information', debugInfo.app)}
        
        {/* Device Info */}
        {debugInfo && renderInfoSection('Device Information', debugInfo.device)}
        
        {/* Network Info */}
        {debugInfo && renderInfoSection('Network Information', debugInfo.network)}
        
        {/* Storage Info */}
        {debugInfo && renderInfoSection('Storage Information', {
          ...debugInfo.storage,
          totalSizeKB: Math.round(debugInfo.storage.totalSize / 1024),
        })}
        
        {/* Auth State */}
        {debugInfo && renderInfoSection('Authentication State', debugInfo.auth)}
        
        {/* Entitlements */}
        {debugInfo && renderInfoSection('Entitlements', debugInfo.entitlements)}
        
        {/* Error Info */}
        {debugInfo && renderInfoSection('Error Information', debugInfo.errors)}
        
        {/* Debug Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Controls</Text>
          
          {renderToggleSection(
            'Offline Mode',
            offlineMode,
            handleToggleOffline,
            'Simulate offline conditions for testing'
          )}
          
          {renderToggleSection(
            'Analytics',
            analyticsEnabled,
            handleToggleAnalytics,
            'Enable/disable analytics tracking'
          )}
        </View>
        
        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          {renderActionButton(
            'Grant Premium Access',
            () => setShowGrantPremium(true),
            <Crown size={20} color={COLORS.PRIMARY} />
          )}
          
          {renderActionButton(
            'View Collected Emails',
            handleViewEmails,
            <Mail size={20} color={COLORS.PRIMARY} />
          )}
          
          {renderActionButton(
            'Export Debug Logs',
            handleExportLogs,
            <Download size={20} color={COLORS.TEXT_PRIMARY} />
          )}
          
          {renderActionButton(
            'Clear Debug Logs',
            handleClearLogs,
            <Trash2 size={20} color={COLORS.WARNING} />,
            false
          )}
          
          {renderActionButton(
            'Reset Progress',
            handleResetProgress,
            <Settings size={20} color={COLORS.WARNING} />,
            false
          )}
          
          {renderActionButton(
            'Clear All Data',
            handleClearAllData,
            <Trash2 size={20} color={COLORS.ERROR} />,
            true
          )}
          
          {__DEV__ && renderActionButton(
            'Test Crash',
            handleTestCrash,
            <Bug size={20} color={COLORS.ERROR} />,
            true
          )}
        </View>

        {/* Logs Viewer */}
        <View style={styles.section}>
          <View style={styles.logsHeader}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <View style={styles.logsActions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => refreshLogs(logLevelFilter)}>
                <RefreshCw size={18} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => refreshLogs(undefined)}>
                <Filter size={18} color={logLevelFilter ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.logFiltersRow}>
            {(['debug','info','warn','error'] as const).map((lvl) => (
              <TouchableOpacity
                key={lvl}
                onPress={() => refreshLogs(lvl)}
                style={[styles.logFilterChip, logLevelFilter === lvl && styles.logFilterChipActive]}
              >
                <Text style={[styles.logFilterText, logLevelFilter === lvl && styles.logFilterTextActive]}>
                  {lvl.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => refreshLogs(undefined)} style={[styles.logFilterChip, !logLevelFilter && styles.logFilterChipActive]}>
              <Text style={[styles.logFilterText, !logLevelFilter && styles.logFilterTextActive]}>ALL</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logsContainer}>
            {logs.length === 0 ? (
              <Text style={styles.noLogsText}>No logs yet.</Text>
            ) : (
              logs.map((entry) => (
                <View key={entry.id} style={[styles.logItem, styles[`log_${entry.level}` as const]]}>
                  <Text style={styles.logMeta}>
                    {new Date(entry.timestamp).toLocaleTimeString()} · {entry.level.toUpperCase()} · {entry.tag}
                  </Text>
                  <Text style={styles.logMessage}>{entry.message}</Text>
                  {entry.data !== undefined && (
                    <Text style={styles.logData}>
                      {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Developer Settings</Text>
          <Text style={styles.footerSubtext}>For debugging and testing purposes only</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutFooterButton}>
            <Text style={styles.logoutFooterButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Grant Premium Modal */}
      {showGrantPremium && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grant Premium Access</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowGrantPremium(false);
                  setGrantEmail('');
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>User Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={grantEmail}
                  onChangeText={setGrantEmail}
                  placeholder="user@example.com"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Subscription Plan</Text>
                <View style={styles.planSelector}>
                  {(['monthly', 'annual', 'lifetime'] as const).map((plan) => (
                    <TouchableOpacity
                      key={plan}
                      style={[
                        styles.planOption,
                        grantPlan === plan && styles.planOptionActive,
                      ]}
                      onPress={() => setGrantPlan(plan)}
                    >
                      <Text
                        style={[
                          styles.planOptionText,
                          grantPlan === plan && styles.planOptionTextActive,
                        ]}
                      >
                        {plan === 'monthly' ? 'Monthly' : plan === 'annual' ? 'Annual' : 'Lifetime'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.grantButton,
                  (!grantEmail.trim() || grantPremiumMutation.isPending) && styles.grantButtonDisabled,
                ]}
                onPress={handleGrantPremium}
                disabled={!grantEmail.trim() || grantPremiumMutation.isPending}
              >
                <Crown size={18} color={COLORS.BACKGROUND} />
                <Text style={styles.grantButtonText}>
                  {grantPremiumMutation.isPending ? 'Granting...' : 'Grant Premium Access'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  sectionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  logsContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 12,
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  log_debug: {},
  log_info: {},
  log_warn: { backgroundColor: `${COLORS.WARNING}10` },
  log_error: { backgroundColor: `${COLORS.ERROR}10` },
  logMeta: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginBottom: 4,
  },
  logMessage: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    marginBottom: 4,
  },
  logData: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noLogsText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  logFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  logFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  logFilterChipActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: `${COLORS.PRIMARY}15`,
  },
  logFilterText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  logFilterTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },
  infoContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoKey: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
    minWidth: 120,
    marginRight: 8,
  },
  infoValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  description: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  destructiveButton: {
    borderColor: COLORS.ERROR,
    backgroundColor: `${COLORS.ERROR}10`,
  },
  actionButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  destructiveText: {
    color: COLORS.ERROR,
  },
  iconContainer: {
    marginRight: 12,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: '600',
  },
  footerSubtext: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  // Login styles
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  loginSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginForm: {
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.BORDER,
  },
  loginButtonText: {
    color: COLORS.BACKGROUND,
    fontSize: 16,
    fontWeight: '600',
  },
  loginButtonTextDisabled: {
    color: COLORS.TEXT_MUTED,
  },
  loginFooter: {
    alignItems: 'center',
  },
  loginFooterText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  loginFooterSubtext: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  logoutButton: {
    padding: 8,
    marginRight: -8,
  },
  logoutButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: '500',
  },
  logoutFooterButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  logoutFooterButtonText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
  },
  // Grant Premium Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 24,
    fontWeight: '300',
  },
  modalBody: {
    gap: 16,
  },
  planSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  planOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
  },
  planOptionActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: `${COLORS.PRIMARY}15`,
  },
  planOptionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
  },
  planOptionTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  grantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 8,
  },
  grantButtonDisabled: {
    backgroundColor: COLORS.BORDER,
    opacity: 0.6,
  },
  grantButtonText: {
    color: COLORS.BACKGROUND,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DevSettingsScreen;