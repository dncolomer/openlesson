'use client';

import { useI18n, languageNames } from '@/lib/i18n';
import { ChevronDown, Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher({
  variant = "default",
}: {
  variant?: "default" | "sidebar";
}) {
  const { locale, setLocale, supportedLocales, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === "sidebar") {
    return (
      <label
        data-dashboard-language
        className="block w-full whitespace-nowrap px-2 py-1 text-[13px] leading-tight text-neutral-400"
      >
        <span className="sr-only">{t("language.select")}</span>
        <select
          value={locale}
          onChange={(event) => {
            const next = supportedLocales.find((item) => item === event.target.value);
            if (next) setLocale(next);
          }}
          className="w-full cursor-pointer rounded-none border-0 bg-transparent py-0 text-[13px] text-neutral-400 focus:outline-none"
        >
          {supportedLocales.map((loc) => (
            <option key={loc} value={loc}>
              {languageNames[loc]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
        aria-label={t('language.select')}
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{languageNames[locale]}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-neutral-950 border border-neutral-800 rounded-sm shadow-lg z-50">
          {supportedLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setLocale(loc);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-800 first:rounded-t-sm last:rounded-b-sm ${
                locale === loc ? 'bg-neutral-800 font-medium text-white' : 'text-neutral-300'
              }`}
            >
              {languageNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
