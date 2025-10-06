import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function Skeleton({ width = '100%', height = 14, borderRadius = 8, style, testID }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ['#222222', '#2E2E2E'],
  });

  return (
    <Animated.View
      testID={testID ?? 'skeleton'}
      style={[styles.base, { width, height, borderRadius, backgroundColor }, style]}
    />
  );
}

export function SkeletonBlock({ lines = 3, lineHeight = 14, gap = 10 }: { lines?: number; lineHeight?: number; gap?: number }) {
  const items = Array.from({ length: lines });
  return (
    <View accessibilityLabel="Loading content" style={styles.block}>
      {items.map((_, idx) => (
        <Skeleton key={`sk-${idx}`} height={lineHeight} style={{ marginBottom: idx === lines - 1 ? 0 : gap }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  block: {
    width: '100%',
  },
});