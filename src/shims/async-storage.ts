const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('AsyncStorage setItem failed:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
  clear: async (): Promise<void> => {
    try {
      localStorage.clear();
    } catch {}
  },
  getAllKeys: async (): Promise<string[]> => {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  },
  multiGet: async (keys: string[]): Promise<Array<[string, string | null]>> => {
    return keys.map((key) => [key, localStorage.getItem(key)]);
  },
  multiSet: async (keyValuePairs: Array<[string, string]>): Promise<void> => {
    keyValuePairs.forEach(([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    });
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  },
};

export default AsyncStorage;
