import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface RouterContextType {
  pathname: string;
  params: Record<string, any>;
  push: (href: string, options?: any) => void;
  replace: (href: string, options?: any) => void;
  back: () => void;
  canGoBack: () => boolean;
  history: string[];
}

const RouterContext = createContext<RouterContextType>({
  pathname: '/',
  params: {},
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => false,
  history: ['/'],
});

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<string[]>(['/']);
  const [params, setParams] = useState<Record<string, any>>({});

  const pathname = history[history.length - 1] || '/';

  const push = useCallback((href: string, options?: any) => {
    let clean = href.startsWith('/') ? href : `/${href}`;
    const [pathPart, queryPart] = clean.split('?');
    if (queryPart) {
      const parsed: Record<string, string> = {};
      new URLSearchParams(queryPart).forEach((v, k) => {
        parsed[k] = v;
      });
      setParams(parsed);
    } else if (options?.params) {
      setParams(options.params);
    }
    setHistory((prev) => [...prev, pathPart]);
  }, []);

  const replace = useCallback((href: string, options?: any) => {
    let clean = href.startsWith('/') ? href : `/${href}`;
    const [pathPart, queryPart] = clean.split('?');
    if (queryPart) {
      const parsed: Record<string, string> = {};
      new URLSearchParams(queryPart).forEach((v, k) => {
        parsed[k] = v;
      });
      setParams(parsed);
    } else if (options?.params) {
      setParams(options.params);
    }
    setHistory((prev) => [...prev.slice(0, -1), pathPart]);
  }, []);

  const back = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const canGoBack = useCallback(() => history.length > 1, [history.length]);

  return (
    <RouterContext.Provider value={{ pathname, params, push, replace, back, canGoBack, history }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  return {
    push: ctx.push,
    replace: ctx.replace,
    back: ctx.back,
    canGoBack: ctx.canGoBack,
    pathname: ctx.pathname,
  };
};

export const useLocalSearchParams = () => {
  const ctx = useContext(RouterContext);
  return ctx.params;
};

export const useFocusEffect = (callback: () => void | (() => void)) => {
  useEffect(() => {
    return callback();
  }, []);
};

export const Link: React.FC<{ href: string; children: React.ReactNode; style?: any }> = ({
  href,
  children,
  style,
}) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={style} onPress={() => router.push(href)}>
      {children}
    </TouchableOpacity>
  );
};

export interface StackScreenProps {
  name: string;
  options?: any;
  component?: React.ComponentType<any>;
}

export const Stack: React.FC<{ screenOptions?: any; children?: React.ReactNode }> & {
  Screen: React.FC<StackScreenProps>;
} = ({ children }) => {
  const { pathname } = useContext(RouterContext);

  // Match active screen
  const screens: Record<string, any> = {};
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<StackScreenProps>(child) && child.props.name) {
      screens[child.props.name] = child;
    }
  });

  // Decide which screen to show
  let activeName = 'index';
  if (pathname === '/settings' || pathname === 'settings') {
    activeName = 'settings';
  } else if (pathname === '/+not-found' || pathname === '+not-found') {
    activeName = '+not-found';
  }

  // Lazy render screen component
  return (
    <View style={styles.stackContainer}>
      <ScreenRenderer activeName={activeName} />
    </View>
  );
};

Stack.Screen = ({ name, options }: StackScreenProps) => {
  return null;
};

// Screen router
import IndexScreen from '@/app/index';
import SettingsScreen from '@/app/settings';

const NotFoundScreen: React.FC = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 24 }}>
    <Text style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>Page Not Found</Text>
    <TouchableOpacity
      onPress={() => window.location.hash = '/'}
      style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#6366f1', borderRadius: 8 }}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Home</Text>
    </TouchableOpacity>
  </View>
);

const ScreenRenderer: React.FC<{ activeName: string }> = ({ activeName }) => {
  switch (activeName) {
    case 'settings':
      return <SettingsScreen />;
    case '+not-found':
      return <NotFoundScreen />;
    case 'index':
    default:
      return <IndexScreen />;
  }
};

const styles = StyleSheet.create({
  stackContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

export default {
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
  Link,
  Stack,
  RouterProvider,
};
