import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';

type Language = 'en' | 'cn';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: { [key: string]: string }) => string;
}

const translations: { [key: string]: any } = { en: {}, cn: {} };

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang) return savedLang;
    
    const browserLang = navigator.language.split(/[-_]/)[0];
    return browserLang === 'zh' ? 'cn' : 'en';
  });
  const [translationsLoaded, setTranslationsLoaded] = useState(false);

  useEffect(() => {
    // Fetch translation files from the public directory.
    Promise.all([
        fetch('/locales/en.json').then(res => res.json()),
        fetch('/locales/cn.json').then(res => res.json())
    ]).then(([en, cn]) => {
        translations.en = en;
        translations.cn = cn;
        setTranslationsLoaded(true);
    }).catch(err => {
        console.error("Failed to load translations:", err);
        setTranslationsLoaded(true); // Proceed so the app doesn't hang on error
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = useCallback((key: string, replacements?: { [key: string]: string }): string => {
    if (!translationsLoaded) return ''; // Return empty string or a loading indicator while fetching
    const keys = key.split('.');
    let result = translations[language];
    for (const k of keys) {
      result = result?.[k];
    }
    
    let template = result || key;

    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            template = template.replace(`{${rKey}}`, replacements[rKey]);
        });
    }

    return template;
  }, [language, translationsLoaded]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  // Don't render the app until translations are loaded to prevent untranslated text flashing.
  if (!translationsLoaded) {
    return null; 
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};