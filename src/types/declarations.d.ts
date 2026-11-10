declare module 'react-native-web' {
  const all: any;
  export default all;
  export * from 'react-native';
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export const SafeAreaView: any;
  export const useSafeAreaInsets: () => { top: number; right: number; bottom: number; left: number };
}

declare module '@workspace/api-client-react' {
  export const setAuthTokenGetter: (fn: any) => void;
  export const setBaseUrl: (url: string) => void;
  export const getBaseUrl: () => string;
}

declare module '@expo-google-fonts/inter' {
  export const Inter_400Regular: string;
  export const Inter_500Medium: string;
  export const Inter_600SemiBold: string;
  export const Inter_700Bold: string;
}

declare module 'expo-router' {
  export const useRouter: () => any;
  export const useFocusEffect: (cb: any) => void;
  export const useLocalSearchParams: () => any;
  export const Stack: any;
  export const Link: any;
}

declare module 'expo-splash-screen' {
  export const preventAutoHideAsync: () => Promise<boolean>;
  export const hideAsync: () => Promise<boolean>;
}

declare module 'expo-image-picker' {
  export type ImagePickerAsset = {
    uri: string;
    width?: number;
    height?: number;
    type?: string;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    base64?: string;
  };
  export const MediaTypeOptions: any;
  export const launchImageLibraryAsync: (opts?: any) => Promise<any>;
  export const launchCameraAsync: (opts?: any) => Promise<any>;
  export const requestMediaLibraryPermissionsAsync: () => Promise<any>;
  export const requestCameraPermissionsAsync: () => Promise<any>;
}

declare module 'expo-navigation-bar' {
  export const NavigationBar: any;
  export const setBackgroundColorAsync: (color: string) => Promise<void>;
  export const setButtonStyleAsync: (style: string) => Promise<void>;
  export const setStyle: (style: string) => Promise<void>;
}

declare module 'expo-status-bar' {
  export const StatusBar: React.ComponentType<any>;
}

declare module 'react-native-gesture-handler' {
  export const GestureHandlerRootView: React.ComponentType<any>;
}

declare module 'expo-linear-gradient' {
  export const LinearGradient: React.ComponentType<any>;
}

declare module 'react-native-keyboard-controller' {
  export const KeyboardProvider: any;
  export const KeyboardAvoidingView: any;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    getAllKeys: () => Promise<string[]>;
    multiGet: (keys: string[]) => Promise<Array<[string, string | null]>>;
  };
  export default AsyncStorage;
}
