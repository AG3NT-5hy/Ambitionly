import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, Platform } from 'react-native';
import { COLORS } from '../constants';
import { trpc } from '../lib/trpc';
import { Mail, Download, Trash2, Filter, RefreshCw, User, Clock, SignIn, UserPlus } from 'lucide-react-native';

type EmailRecord = {
  email: string;
  userId: string;
  timestamp: string;
  source: 'signup' | 'login';
};

type FilterType = 'all' | 'signup' | 'login';

export default function EmailViewerFallback() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'email'>('timestamp');

  const { data, isLoading, error, refetch } = trpc.admin.emails.get.useQuery();
  const exportMutation = trpc.admin.emails.export.useMutation();
  const clearMutation = trpc.admin.emails.clear.useMutation();

  const emails = data?.emails || [];
  const stats = data?.stats;

  const filteredEmails = React.useMemo(() => {
    let filtered = [...emails];
    
    if (filter !== 'all') {
      filtered = filtered.filter(e => e.source === filter);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'timestamp') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      } else {
        return a.email.localeCompare(b.email);
      }
    });

    return filtered;
  }, [emails, filter, sortBy]);

  const handleExport = async (format: 'text' | 'csv') => {
    try {
      const result = await exportMutation.mutateAsync({ format });
      if (result.content) {
        if (Platform.OS === 'web') {
          const blob = new Blob([result.content], { type: format === 'csv' ? 'text/csv' : 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `collected-emails-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'txt'}`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          await Share.share({
            message: result.content,
            title: `Collected Emails (${format.toUpperCase()})`,
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export emails');
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear All Emails',
      'Are you sure you want to clear all collected emails? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearMutation.mutateAsync();
              refetch();
              Alert.alert('Success', 'All emails have been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear emails');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Loading emails...</Text>
      </View>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3000';
    
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load emails</Text>
        <Text style={styles.errorDetail}>{errorMessage}</Text>
        <Text style={styles.errorDetail}>API URL: {apiUrl}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <RefreshCw size={16} color={COLORS.PRIMARY} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Statistics Card */}
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.unique}</Text>
              <Text style={styles.statLabel}>Unique</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.signups}</Text>
              <Text style={styles.statLabel}>Signups</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.logins}</Text>
              <Text style={styles.statLabel}>Logins</Text>
            </View>
          </View>
          {stats.lastUpdated && (
            <Text style={styles.lastUpdated}>
              Last updated: {formatDate(stats.lastUpdated)}
            </Text>
          )}
        </View>
      )}

      {/* Actions Bar */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => refetch()}
        >
          <RefreshCw size={18} color={COLORS.PRIMARY} />
          <Text style={styles.actionButtonText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleExport('text')}
        >
          <Download size={18} color={COLORS.PRIMARY} />
          <Text style={styles.actionButtonText}>Export TXT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleExport('csv')}
        >
          <Download size={18} color={COLORS.PRIMARY} />
          <Text style={styles.actionButtonText}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.destructiveButton]}
          onPress={handleClear}
        >
          <Trash2 size={18} color={COLORS.ERROR} />
          <Text style={[styles.actionButtonText, styles.destructiveText]}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Filter size={16} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.filterLabel}>Source:</Text>
          {(['all', 'signup', 'login'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'signup' ? 'Signups' : 'Logins'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Sort by:</Text>
          <TouchableOpacity
            style={[styles.filterChip, sortBy === 'timestamp' && styles.filterChipActive]}
            onPress={() => setSortBy('timestamp')}
          >
            <Text style={[styles.filterChipText, sortBy === 'timestamp' && styles.filterChipTextActive]}>
              Date
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, sortBy === 'email' && styles.filterChipActive]}
            onPress={() => setSortBy('email')}
          >
            <Text style={[styles.filterChipText, sortBy === 'email' && styles.filterChipTextActive]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Email List */}
      <View style={styles.emailListContainer}>
        <Text style={styles.emailListTitle}>
          Emails ({filteredEmails.length})
        </Text>
        {filteredEmails.length === 0 ? (
          <View style={styles.emptyState}>
            <Mail size={48} color={COLORS.TEXT_MUTED} />
            <Text style={styles.emptyStateText}>No emails found</Text>
            <Text style={styles.emptyStateSubtext}>
              {filter !== 'all' ? `Try changing the filter` : 'No emails have been collected yet'}
            </Text>
          </View>
        ) : (
          filteredEmails.map((email, index) => (
            <View key={`${email.email}-${email.timestamp}-${index}`} style={styles.emailCard}>
              <View style={styles.emailHeader}>
                <View style={styles.emailIconContainer}>
                  {email.source === 'signup' ? (
                    <UserPlus size={16} color={COLORS.SUCCESS} />
                  ) : (
                    <SignIn size={16} color={COLORS.PRIMARY} />
                  )}
                </View>
                <View style={styles.emailInfo}>
                  <Text style={styles.emailAddress}>{email.email}</Text>
                  <View style={styles.emailMeta}>
                    <View style={styles.emailMetaItem}>
                      <User size={12} color={COLORS.TEXT_MUTED} />
                      <Text style={[styles.emailMetaText, styles.emailMetaTextWithIcon]}>{email.userId}</Text>
                    </View>
                    <View style={styles.emailMetaItem}>
                      <Clock size={12} color={COLORS.TEXT_MUTED} />
                      <Text style={[styles.emailMetaText, styles.emailMetaTextWithIcon]}>{formatDate(email.timestamp)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.sourceBadge, email.source === 'signup' ? styles.sourceBadgeSignup : styles.sourceBadgeLogin]}>
                  <Text style={styles.sourceBadgeText}>
                    {email.source === 'signup' ? 'Signup' : 'Login'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 16,
    marginBottom: 8,
  },
  errorDetail: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  retryButtonText: {
    color: COLORS.PRIMARY,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
  },
  statValue: {
    color: COLORS.PRIMARY,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  lastUpdated: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    flex: 1,
    minWidth: '22%',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  destructiveButton: {
    borderColor: COLORS.ERROR,
    backgroundColor: `${COLORS.ERROR}10`,
  },
  actionButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  destructiveText: {
    color: COLORS.ERROR,
  },
  filtersContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 12,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
    marginRight: 8,
  },
  filterChipActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: `${COLORS.PRIMARY}15`,
  },
  filterChipText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  emailListContainer: {
    marginBottom: 16,
  },
  emailListTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emailCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 16,
    marginBottom: 12,
  },
  emailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emailInfo: {
    flex: 1,
  },
  emailAddress: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  emailMetaText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
  },
  emailMetaTextWithIcon: {
    marginLeft: 4,
  },
  sourceBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  sourceBadgeSignup: {
    backgroundColor: `${COLORS.SUCCESS}20`,
  },
  sourceBadgeLogin: {
    backgroundColor: `${COLORS.PRIMARY}20`,
  },
  sourceBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyStateText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    textAlign: 'center',
  },
});


