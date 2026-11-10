import React from 'react';
import { View } from 'react-native';

export const BlurView: React.FC<{
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: any;
  children?: React.ReactNode;
}> = ({ intensity = 50, tint = 'dark', style, children, ...props }) => {
  const bg = tint === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)';
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          backdropFilter: `blur(${Math.round(intensity / 4)}px)`,
          WebkitBackdropFilter: `blur(${Math.round(intensity / 4)}px)`,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

export default BlurView;
