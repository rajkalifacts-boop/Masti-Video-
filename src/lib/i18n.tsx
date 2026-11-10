import React, { createContext, useContext, useState } from 'react';
import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from 'react-native';

export interface LanguageOption {
  code: string;
  value: string;
  label: string;
  nativeLabel: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', value: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', value: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'bn', value: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'te', value: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'mr', value: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'ta', value: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'ur', value: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
  { code: 'gu', value: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'kn', value: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'pa', value: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
];

const TRANSLATIONS: Record<string, Record<string, string>> = {
  hi: {
    'Home': 'होम',
    'Friends': 'मित्र',
    'Inbox': 'इनबॉक्स',
    'Profile': 'प्रोफ़ाइल',
    'Settings': 'सेटिंग्स',
    'Follow': 'फॉलो',
    'Following': 'फॉलोइंग',
    'Followers': 'फॉलोअर्स',
    'Likes': 'लाइक्स',
    'Comments': 'टिप्पणियां',
    'Share': 'शेयर',
    'Save': 'सेव',
    'Original Audio': 'ओरिजिनल ऑडियो',
    'Oops!': 'ओह!',
    "This screen doesn't exist.": 'यह स्क्रीन मौजूद नहीं है।',
    'Go to home screen!': 'होम स्क्रीन पर जाएं!',
    'Search': 'खोजें',
    'Search creators, videos': 'क्रिएटर्स, वीडियो खोजें',
    'Monetization': 'कमाई / मोनेटाइजेशन',
    'Edit Profile': 'प्रोफ़ाइल बदलें',
    'Help & Support': 'मदद और सहायता',
    'Log out': 'लॉग आउट',
    'Delete': 'हटाएं',
    'Cancel': 'रद्द करें',
  },
};

export const translateText = (text: any, language = 'en'): string => {
  if (typeof text !== 'string') return text ? String(text) : '';
  if (language === 'en') return text;
  const langTable = TRANSLATIONS[language];
  if (langTable && langTable[text]) {
    return langTable[text];
  }
  return text;
};

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    try {
      return localStorage.getItem('@masti_app_language') || 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = async (lang: string) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('@masti_app_language', lang);
    } catch {}
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useAppLanguage = () => useContext(LanguageContext);

export const LocalizedText: React.FC<TextProps & { children?: any }> = ({ children, ...props }) => {
  const { language } = useAppLanguage();
  let content = children;
  if (typeof children === 'string') {
    content = translateText(children, language);
  }
  return <RNText {...props}>{content}</RNText>;
};

export const LocalizedTextInput = React.forwardRef<any, TextInputProps>(({ placeholder, ...props }, ref) => {
  const { language } = useAppLanguage();
  const localizedPlaceholder = placeholder ? translateText(placeholder, language) : placeholder;
  return <RNTextInput ref={ref as any} {...props} placeholder={localizedPlaceholder} />;
});
LocalizedTextInput.displayName = 'LocalizedTextInput';

export default {
  LANGUAGE_OPTIONS,
  translateText,
  useAppLanguage,
  LanguageProvider,
  LocalizedText,
  LocalizedTextInput,
};
