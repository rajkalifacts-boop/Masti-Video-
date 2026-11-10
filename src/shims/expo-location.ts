export const requestForegroundPermissionsAsync = async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
});

export const getCurrentPositionAsync = async () => ({
  coords: {
    latitude: 28.6139,
    longitude: 77.209,
    altitude: 0,
    accuracy: 10,
    heading: 0,
    speed: 0,
  },
  timestamp: Date.now(),
});

export const reverseGeocodeAsync = async () => [
  {
    city: 'New Delhi',
    region: 'Delhi',
    country: 'India',
    name: 'India Gate',
    postalCode: '110001',
  },
];

export default {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  reverseGeocodeAsync,
};
