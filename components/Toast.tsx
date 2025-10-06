import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export interface ToastProps {
  message: string;
  visible: boolean;
  type?: 'info' | 'success' | 'error' | 'warning';
  onHide?: () => void;
  testID?: string;
}

export default function Toast({ message, visible, type = 'info', onHide, testID }: ToastProps) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        timeoutRef.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, { toValue: -60, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onHide?.());
        }, 2500);
      });
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, onHide, opacity, translateY]);

  if (!visible) return null;

  const bg = type === 'error' ? '#B42318' : type === 'success' ? '#12B76A' : type === 'warning' ? '#F79009' : '#2563EB';

  return (
    <Animated.View testID={testID ?? 'toast'} style={[styles.container, { transform: [{ translateY }], opacity }] }>
      <View style={[styles.inner, { backgroundColor: bg }] }>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
