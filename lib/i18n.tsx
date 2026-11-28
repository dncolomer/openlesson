'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import en from '../messages/en.json';

export type Locale = 'en' | 'vi' | 'zh' | 'es' | 'de' | 'pl';

type MessageTree = {
  [key: string]: string | MessageTree;
};

const supportedLocales: Locale[] = ['en', 'vi', 'zh', 'es', 'de', 'pl'];

const loadedBundles: Partial<Record<Locale, MessageTree>> = {
  en: en as MessageTree,
};

const pendingLoads: Partial<Record<Locale, Promise<MessageTree>>> = {};

const localeLoaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: unknown }>> = {
  vi: () => import('../messages/vi.json'),
  zh: () => import('../messages/zh.json'),
  es: () => import('../messages/es.json'),
  de: () => import('../messages/de.json'),
  pl: () => import('../messages/pl.json'),
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return typeof value === 'string' && (supportedLocales as string[]).includes(value);
}

/**
 * Lazily load and cache a locale bundle on demand so non-English bundles
 * are code-split out of the initial root client chunk.
 */
export async function loadLocaleBundle(locale: string): Promise<MessageTree> {
  if (!isSupportedLocale(locale) || locale === 'en') {
    return loadedBundles.en as MessageTree;
  }
  const cached = loadedBundles[locale];
  if (cached) return cached;
  let pending = pendingLoads[locale];
  if (!pending) {
    pending = localeLoaders[locale]()
      .then((mod) => {
        const bundle = (mod.default ?? mod) as MessageTree;
        loadedBundles[locale] = bundle;
        return bundle;
      })
      .finally(() => {
        delete pendingLoads[locale];
      });
    pendingLoads[locale] = pending;
  }
  return pending;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  supportedLocales: Locale[];
}

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
 * Falls back to English if the requested locale is unknown, not yet loaded,
 * or missing the key.
 */
export function translateWithLocale(
  locale: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const tryResolve = (loc: string): string | null => {
    const bundle = isSupportedLocale(loc) ? loadedBundles[loc] : undefined;
    if (!bundle) return null;
    let value: string | MessageTree | undefined = bundle;
    for (const k of key.split('.')) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
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
  const [bundleVersion, setBundleVersion] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    const stored = (() => {
      try {
        return localStorage.getItem('locale');
      } catch {
        return null;
      }
    })();

    let newLocale: Locale = 'en';
    if (isSupportedLocale(urlLang)) {
      newLocale = urlLang;
    } else if (isSupportedLocale(stored)) {
      newLocale = stored;
    } else {
      const browserLang = navigator.language.split('-')[0];
      if (isSupportedLocale(browserLang)) {
        newLocale = browserLang;
      }
    }

    setLocaleState(newLocale);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    if (locale === 'en' || loadedBundles[locale]) return;
    let cancelled = false;
    void loadLocaleBundle(locale).then(() => {
      if (!cancelled) {
        setBundleVersion((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('locale', newLocale);
    } catch {
      // Ignore storage quota/privacy-mode errors
    }

    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLocale);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      void bundleVersion;
      return translateWithLocale(locale, key, params);
    },
    [locale, bundleVersion],
  );

  const contextValue = useMemo<I18nContextType>(
    () => ({ locale, setLocale, t, supportedLocales }),
    [locale, setLocale, t],
  );

  return (
    <I18nContext.Provider value={contextValue}>
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
