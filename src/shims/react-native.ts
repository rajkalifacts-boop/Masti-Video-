import * as RNWeb from 'react-native-web';

export * from 'react-native-web';

export const ToastAndroid = {
  SHORT: 0,
  LONG: 1,
  show: (message: string, _duration?: number) => {
    console.log('[ToastAndroid]', message);
  },
  showWithGravity: (message: string, _duration?: number, _gravity?: number) => {
    console.log('[ToastAndroid]', message);
  },
};

export const PermissionsAndroid = {
  PERMISSIONS: {
    CAMERA: 'android.permission.CAMERA',
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  check: async () => true,
  request: async () => 'granted',
  requestMultiple: async () => ({}),
};

export const BackHandler = {
  addEventListener: (_eventName: string, _handler: () => boolean | null | undefined) => {
    return { remove: () => {} };
  },
  removeEventListener: () => {},
  exitApp: () => {},
};

export default {
  ...RNWeb,
  ToastAndroid,
  PermissionsAndroid,
  BackHandler,
};
