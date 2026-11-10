import { useRef } from 'react';

export const useSharedValue = <T>(initialValue: T) => {
  const ref = useRef({ value: initialValue });
  return ref.current;
};

export const useAnimatedStyle = (styleFn: () => any) => {
  try {
    return styleFn();
  } catch {
    return {};
  }
};

export const useAnimatedReaction = () => {};

export const useAnimatedScrollHandler = () => () => {};

export const withTiming = (toValue: any, _config?: any, callback?: () => void) => {
  if (callback) setTimeout(callback, 10);
  return toValue;
};

export const withSpring = (toValue: any, _config?: any, callback?: () => void) => {
  if (callback) setTimeout(callback, 10);
  return toValue;
};

export const withDelay = (_delayMs: number, animation: any) => animation;

export const withSequence = (...animations: any[]) => animations[animations.length - 1];

export const withRepeat = (animation: any, _count?: number) => animation;

export const cancelAnimation = () => {};

export const runOnJS = (fn: any) => fn;

export const interpolate = (val: any) => val;
export const interpolateColor = (_val: any, _input: any, output: any) => output[0] || '#000';

export const Extrapolate = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };

export const Easing = {
  inOut: (f: any) => f,
  ease: (t: any) => t,
  linear: (t: any) => t,
  bezier: () => (t: any) => t,
};

import { View, ScrollView, Image, Text } from 'react-native';

const Reanimated = {
  createAnimatedComponent: (Comp: any) => Comp,
  View,
  ScrollView,
  Image,
  Text,
};

export default Reanimated;
