import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SuccessToastContextType {
  showSuccessToast: (message: string) => void;
}

const SuccessToastContext = createContext<SuccessToastContextType>({
  showSuccessToast: () => {},
});

export const SuccessToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastText, setToastText] = useState('');
  const [visible, setVisible] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccessToast = useCallback((message: string) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setToastText(message);
    setVisible(true);

    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    hideTimerRef.current = setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }, 2800);
  }, [opacityAnim]);

  return (
    <SuccessToastContext.Provider value={{ showSuccessToast }}>
      {children}
      {visible && (
        <Animated.View style={[styles.toastContainer, { opacity: opacityAnim }]} pointerEvents="none">
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" style={{ marginRight: 8 }} />
            <Text style={styles.toastText}>{toastText}</Text>
          </View>
        </Animated.View>
      )}
    </SuccessToastContext.Provider>
  );
};

export const useSuccessToast = () => useContext(SuccessToastContext);

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 99999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3f3f46',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SuccessToastProvider;
