import React from 'react';
import { View } from 'react-native';

export const FeedBannerAd: React.FC<{ style?: any }> = () => {
  return null;
};

export const useFeedInterstitial = (_config?: any) => {
  const showInterstitial = async () => {};
  return { showInterstitial };
};

export default {
  FeedBannerAd,
  useFeedInterstitial,
};
