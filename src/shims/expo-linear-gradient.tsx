import React from 'react';
import { View } from 'react-native';

export const LinearGradient: React.FC<{
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: any;
  children?: React.ReactNode;
}> = ({ colors, style, children }) => {
  const bg = colors && colors.length > 0 ? colors[0] : '#FF2D55';
  return (
    <View style={[{ backgroundColor: bg }, style]}>
      {children}
    </View>
  );
};

export default { LinearGradient };
