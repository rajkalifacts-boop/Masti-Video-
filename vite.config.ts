import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      global: 'window',
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      'process.env.EXPO_PUBLIC_DOMAIN': JSON.stringify(''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'react-native': path.resolve(__dirname, 'src/shims/react-native.ts'),
        'expo-router': path.resolve(__dirname, 'src/shims/expo-router.tsx'),
        '@expo/vector-icons': path.resolve(__dirname, 'src/shims/expo-vector-icons.tsx'),
        '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/shims/async-storage.ts'),
        'expo-camera': path.resolve(__dirname, 'src/shims/expo-camera.tsx'),
        'expo-image-picker': path.resolve(__dirname, 'src/shims/expo-image-picker.ts'),
        'expo-file-system': path.resolve(__dirname, 'src/shims/expo-file-system.ts'),
        'expo-location': path.resolve(__dirname, 'src/shims/expo-location.ts'),
        'expo-blur': path.resolve(__dirname, 'src/shims/expo-blur.tsx'),
        'expo-video-thumbnails': path.resolve(__dirname, 'src/shims/expo-video-thumbnails.ts'),
        'expo-haptics': path.resolve(__dirname, 'src/shims/expo-haptics.ts'),
        'expo-status-bar': path.resolve(__dirname, 'src/shims/expo-status-bar.tsx'),
        'expo-navigation-bar': path.resolve(__dirname, 'src/shims/expo-navigation-bar.ts'),
        'expo-font': path.resolve(__dirname, 'src/shims/expo-font.ts'),
        'expo-linear-gradient': path.resolve(__dirname, 'src/shims/expo-linear-gradient.tsx'),
        'expo-splash-screen': path.resolve(__dirname, 'src/shims/expo-splash-screen.ts'),
        '@expo-google-fonts/inter': path.resolve(__dirname, 'src/shims/expo-google-fonts.ts'),
        'react-native-gesture-handler': path.resolve(__dirname, 'src/shims/react-native-gesture-handler.tsx'),
        'react-native-keyboard-controller': path.resolve(__dirname, 'src/shims/react-native-keyboard-controller.tsx'),
        'react-native-reanimated': path.resolve(__dirname, 'src/shims/react-native-reanimated.ts'),
        'react-native-svg': path.resolve(__dirname, 'src/shims/react-native-svg.tsx'),
        'react-native-safe-area-context': path.resolve(__dirname, 'src/shims/react-native-safe-area-context.tsx'),
        '@workspace/api-client-react': path.resolve(__dirname, 'src/shims/api-client-react.ts'),
      },
      extensions: [
        '.web.mjs',
        '.web.js',
        '.web.jsx',
        '.web.ts',
        '.web.tsx',
        '.mjs',
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.json',
      ],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
