import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants';

export default function EmailViewerFallback() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Collected Emails</Text>
        <Text style={styles.subtitle}>Debug Viewer Placeholder</Text>
        <Text style={styles.text}>
          This is a fallback viewer. If you have a richer email viewer in your backup,
          replace this component at {'components/EmailViewerFallback.tsx'} with your original version.
        </Text>
        <Text style={styles.text}>
          The Developer Settings screen will navigate here when selecting "View Collected Emails".
        </Text>
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
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 16,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    marginBottom: 12,
  },
  text: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
});


