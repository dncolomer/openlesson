'use client';

import { createContext, useContext, useEffect, useState, Suspense } from 'react';
 
const en = require('../messages/en.json');
 
const vi = require('../messages/vi.json');
 
const zh = require('../messages/zh.json');
 
const es = require('../messages/es.json');
 
const de = require('../messages/de.json');
 
const pl = require('../messages/pl.json');

type Locale = 'en' | 'vi' | 'zh' | 'es' | 'de' | 'pl';

 
const messages: Record<Locale, any> = {
  en,
  vi,
  zh,
  es,
  de,
  pl,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  supportedLocales: Locale[];
}

const supportedLocales: Locale[] = ['en', 'vi', 'zh', 'es', 'de', 'pl'];

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: () => '',
  supportedLocales,
});

export function useI18n() {
  return useContext(I18nContext);
}

/**
 * Translate a key against an explicit locale, independent of the active
 * UI locale. Useful for content that should follow the tutoring language
 * (e.g. the tutor's welcome greeting) rather than the UI chrome language.
 * Falls back to English if the requested locale is unknown or the key is
 * missing in that locale.
 */
export function translateWithLocale(
  locale: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const tryResolve = (loc: string): string | null => {
     
    const bundle: any = (messages as Record<string, any>)[loc];
    if (!bundle) return null;
    let value: unknown = bundle;
    for (const k of key.split('.')) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return null;
      }
    }
    return typeof value === 'string' ? value : null;
  };

  const resolved = tryResolve(locale) ?? tryResolve('en');
  if (resolved === null) return key;
  if (params) {
    return resolved.replace(/\{(\w+)\}/g, (_, paramKey) =>
      String(params[paramKey] ?? `{${paramKey}}`),
    );
  }
  return resolved;
}

function I18nProviderInner({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    const stored = localStorage.getItem('locale') as Locale;
    
    let newLocale: Locale = 'en';
    
    if (urlLang && supportedLocales.includes(urlLang as Locale)) {
      newLocale = urlLang as Locale;
    } else if (stored && supportedLocales.includes(stored)) {
      newLocale = stored;
    } else {
      const browserLang = navigator.language.split('-')[0];
      if (supportedLocales.includes(browserLang as Locale)) {
        newLocale = browserLang as Locale;
      }
    }
    
    setLocaleState(newLocale);
    setIsInitialized(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    
    const params = new URLSearchParams(window.location.search);
    params.set('lang', newLocale);
    window.location.search = params.toString();
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    return translateWithLocale(locale, key, params);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, supportedLocales }}>
      {children}
    </I18nContext.Provider>
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <I18nProviderInner>{children}</I18nProviderInner>
    </Suspense>
  );
}

export const languageNames: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  zh: '中文',
  es: 'Español',
  de: 'Deutsch',
  pl: 'Polski',
};
