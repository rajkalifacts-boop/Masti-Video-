import React, { createContext, useContext } from 'react';
import { View } from 'react-native';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const defaultInsets: EdgeInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const SafeAreaContext = createContext<EdgeInsets>(defaultInsets);

export const SafeAreaProvider: React.FC<{ children?: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => (
  <SafeAreaContext.Provider value={defaultInsets}>
    <View style={[{ flex: 1, width: '100%', height: '100%' }, style]}>{children}</View>
  </SafeAreaContext.Provider>
);

export const useSafeAreaInsets = (): EdgeInsets => {
  return useContext(SafeAreaContext) || defaultInsets;
};

export const SafeAreaView: React.FC<{ children?: React.ReactNode; style?: any }> = ({
  children,
  style,
  ...props
}) => (
  <View style={[{ flex: 1 }, style]} {...props}>
    {children}
  </View>
);

export default {
  SafeAreaProvider,
  useSafeAreaInsets,
  SafeAreaView,
};
