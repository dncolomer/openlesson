/**
 * Tutoring languages — the languages the AI tutor can respond in.
 * This is a SUPERSET of UI locales (which only have translation files).
 * Some languages here (e.g. Catalan) are tutoring-only with no UI translation.
 *
 * Spoken selectors (TAP / ILE) use the same full allowlist so conversational
 * TAP and ILE are not narrowed when Exercise TAP is present.
 */

export const tutoringLocales = ["en", "vi", "zh", "es", "de", "pl", "ca"] as const;
export type TutoringLocale = (typeof tutoringLocales)[number];

/** Same allowlist as tutoringLocales — used by TAP/ILE spoken-language selectors. */
export const spokenLocales = tutoringLocales;
export type SpokenLocale = TutoringLocale;

export const tutoringLanguageNames: Record<TutoringLocale, string> = {
  en: "English",
  vi: "Tiếng Việt",
  zh: "中文",
  es: "Español",
  de: "Deutsch",
  pl: "Polski",
  ca: "Català",
};

export const spokenLanguageNames = tutoringLanguageNames;

/** BCP-47 codes for the Web Speech API (and similar STT engines). */
const SPEECH_BCP47_BY_LOCALE: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  vi: "vi-VN",
  zh: "zh-CN",
  pl: "pl-PL",
  ca: "ca-ES",
};

/**
 * Map a short locale code (or full language name) to a Web Speech BCP-47 tag.
 * Defaults to en-US for unknown / empty values.
 */
export function toSpeechBcp47(locale: string | null | undefined): string {
  if (!locale) return "en-US";
  const code = locale.trim().toLowerCase();
  if (SPEECH_BCP47_BY_LOCALE[code]) return SPEECH_BCP47_BY_LOCALE[code];
  // Accept already-BCP-47-ish tags used in older paths
  if (code === "en-us" || code.startsWith("en")) return "en-US";
  if (code === "de-de" || code.startsWith("de")) return "de-DE";
  if (code === "es-es" || code.startsWith("es")) return "es-ES";
  if (code === "vi-vn" || code.startsWith("vi")) return "vi-VN";
  if (code === "zh-cn" || code.startsWith("zh")) return "zh-CN";
  if (code === "pl-pl" || code.startsWith("pl")) return "pl-PL";
  if (code === "ca-es" || code.startsWith("ca")) return "ca-ES";
  return "en-US";
}

/** True when `locale` is one of the publicly selectable spoken/tutoring languages. */
export function isSpokenLocale(locale: string | null | undefined): locale is SpokenLocale {
  return !!locale && (spokenLocales as readonly string[]).includes(locale);
}

/**
 * Coerce any locale (including UI locales outside the spoken set) into a
 * selectable spoken locale. Unknown → English.
 */
export function coerceSpokenLocale(locale: string | null | undefined): SpokenLocale {
  if (isSpokenLocale(locale)) return locale;
  return "en";
}

/**
 * Map locale code to full language name for LLM prompts.
 * Falls back to English if unknown.
 */
export function getLanguageName(locale: string): string {
  return tutoringLanguageNames[locale as TutoringLocale] || "English";
}
