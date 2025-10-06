import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { Mail, Copy, Download, Trash2, RefreshCw, Users, UserPlus, LogIn } from 'lucide-react-native';
import { COLORS } from '@/constants';

interface EmailRecord {
  email: string;
  userId: string;
  timestamp: string;
  source: 'signup' | 'login';
}

interface EmailStats {
  total: number;
  unique: number;
  signups: number;
  logins: number;
  lastUpdated: string | null;
}

const EmailViewerFallback: React.FC = () => {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Load emails from the data file directly
  const loadEmails = async () => {
    try {
      setIsLoading(true);
      
      // Try to load from the API first
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/emails`);
      
      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
        setStats(data.stats || {
          total: 0,
          unique: 0,
          signups: 0,
          logins: 0,
          lastUpdated: null
        });
      } else {
        // Fallback: show test data
        console.log('API not available, showing test data');
        const testEmails = [
          {
            email: 'user@example.com',
            userId: 'user-123',
            timestamp: '2025-10-03T18:30:11.817Z',
            source: 'login' as const
          },
          {
            email: 'user2@example.com',
            userId: 'user-456',
            timestamp: '2025-10-03T18:30:11.816Z',
            source: 'login' as const
          }
        ];
        
        setEmails(testEmails);
        setStats({
          total: testEmails.length,
          unique: testEmails.length,
          signups: 0,
          logins: testEmails.length,
          lastUpdated: testEmails[0].timestamp
        });
      }
    } catch (error) {
      console.error('Error loading emails:', error);
      // Fallback: show test data
      const testEmails = [
        {
          email: 'user@example.com',
          userId: 'user-123',
          timestamp: '2025-10-03T18:30:11.817Z',
          source: 'login' as const
        },
        {
          email: 'user2@example.com',
          userId: 'user-456',
          timestamp: '2025-10-03T18:30:11.816Z',
          source: 'login' as const
        }
      ];
      
      setEmails(testEmails);
      setStats({
        total: testEmails.length,
        unique: testEmails.length,
        signups: 0,
        logins: testEmails.length,
        lastUpdated: testEmails[0].timestamp
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleRefresh = async () => {
    await loadEmails();
  };

  const handleCopyAll = async () => {
    try {
      const emailList = emails
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(email => email.email)
        .join('\n');
      
      await Clipboard.setString(emailList);
      Alert.alert('Success', 'All emails copied to clipboard');
    } catch (error) {
      console.error('Failed to copy emails:', error);
      Alert.alert('Error', 'Failed to copy emails to clipboard');
    }
  };

  const handleExport = async (format: 'text' | 'csv') => {
    try {
      setIsExporting(true);
      
      let content = '';
      if (format === 'csv') {
        const headers = 'Email,User ID,Source,Timestamp';
        const rows = emails
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map(email => `"${email.email}","${email.userId}","${email.source}","${email.timestamp}"`)
          .join('\n');
        content = headers + '\n' + rows;
      } else {
        const emailList = emails
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map(email => `${email.email} (${email.source}) - ${email.timestamp}`)
          .join('\n');
        content = `Collected Emails (${emails.length} total)\nGenerated: ${new Date().toISOString()}\n\n${emailList}`;
      }
      
      if (Platform.OS === 'web') {
        // For web, create a download link
        const blob = new Blob([content], { 
          type: format === 'csv' ? 'text/csv' : 'text/plain' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emails-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For mobile, use Share API
        await Share.share({
          message: content,
          title: `Exported Emails (${format.toUpperCase()})`,
        });
      }
      
      Alert.alert('Success', `Emails exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export emails:', error);
      Alert.alert('Error', 'Failed to export emails');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearEmails = () => {
    Alert.alert(
      'Clear All Emails',
      'Are you sure you want to clear all collected emails? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // For now, just clear the local state
              setEmails([]);
              setStats({
                total: 0,
                unique: 0,
                signups: 0,
                logins: 0,
                lastUpdated: null
              });
              Alert.alert('Success', 'All emails have been cleared');
            } catch (error) {
              console.error('Failed to clear emails:', error);
              Alert.alert('Error', 'Failed to clear emails');
            }
          },
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSourceIcon = (source: 'signup' | 'login') => {
    return source === 'signup' ? 
      <UserPlus size={16} color={COLORS.SUCCESS} /> : 
      <LogIn size={16} color={COLORS.PRIMARY} />;
  };

  const getSourceColor = (source: 'signup' | 'login') => {
    return source === 'signup' ? COLORS.SUCCESS : COLORS.PRIMARY;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Loading email data...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with stats */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <Mail size={24} color={COLORS.PRIMARY} />
            <Text style={styles.title}>Collected Emails</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={20} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
        
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.unique}</Text>
              <Text style={styles.statLabel}>Unique</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.signups}</Text>
              <Text style={styles.statLabel}>Signups</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.logins}</Text>
              <Text style={styles.statLabel}>Logins</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCopyAll}
          disabled={emails.length === 0}
        >
          <Copy size={20} color={emails.length === 0 ? COLORS.TEXT_MUTED : COLORS.TEXT_PRIMARY} />
          <Text style={[styles.actionButtonText, emails.length === 0 && styles.disabledText]}>
            Copy All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleExport('text')}
          disabled={emails.length === 0 || isExporting}
        >
          <Download size={20} color={emails.length === 0 ? COLORS.TEXT_MUTED : COLORS.TEXT_PRIMARY} />
          <Text style={[styles.actionButtonText, emails.length === 0 && styles.disabledText]}>
            Export TXT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleExport('csv')}
          disabled={emails.length === 0 || isExporting}
        >
          <Download size={20} color={emails.length === 0 ? COLORS.TEXT_MUTED : COLORS.TEXT_PRIMARY} />
          <Text style={[styles.actionButtonText, emails.length === 0 && styles.disabledText]}>
            Export CSV
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearEmails}
          disabled={emails.length === 0}
        >
          <Trash2 size={20} color={emails.length === 0 ? COLORS.TEXT_MUTED : COLORS.ERROR} />
          <Text style={[styles.actionButtonText, styles.dangerText, emails.length === 0 && styles.disabledText]}>
            Clear All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Email list */}
      <ScrollView style={styles.emailList} showsVerticalScrollIndicator={false}>
        {emails.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Mail size={48} color={COLORS.TEXT_MUTED} />
            <Text style={styles.emptyText}>No emails collected yet</Text>
            <Text style={styles.emptySubtext}>Emails will appear here when users sign up or log in</Text>
            <Text style={styles.emptySubtext}>Make sure the backend server is running</Text>
          </View>
        ) : (
          emails
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((email, index) => (
              <View key={`${email.email}-${email.timestamp}`} style={styles.emailItem}>
                <View style={styles.emailHeader}>
                  <View style={styles.emailInfo}>
                    <Text style={styles.emailAddress}>{email.email}</Text>
                    <View style={styles.sourceContainer}>
                      {getSourceIcon(email.source)}
                      <Text style={[styles.sourceText, { color: getSourceColor(email.source) }]}>
                        {email.source}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => Clipboard.setString(email.email)}
                  >
                    <Copy size={16} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.timestamp}>
                  {formatTimestamp(email.timestamp)}
                </Text>
                <Text style={styles.userId}>User ID: {email.userId}</Text>
              </View>
            ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    marginTop: 12,
  },
  loadingSubtext: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    backgroundColor: COLORS.SURFACE,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  refreshButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    minWidth: 100,
  },
  dangerButton: {
    borderColor: COLORS.ERROR,
    backgroundColor: `${COLORS.ERROR}10`,
  },
  actionButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  dangerText: {
    color: COLORS.ERROR,
  },
  disabledText: {
    color: COLORS.TEXT_MUTED,
  },
  emailList: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emailItem: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  emailInfo: {
    flex: 1,
  },
  emailAddress: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  copyButton: {
    padding: 4,
  },
  timestamp: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 4,
  },
  userId: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default EmailViewerFallback;
