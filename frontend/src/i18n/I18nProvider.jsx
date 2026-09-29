'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, LANGUAGES, LANG_COOKIE, LANG_STORAGE, htmlLangFor, normalizeLang, translate } from './index';

const I18nContext = createContext(null);

const readCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null;
};

const writeCookie = (name, value) => {
  if (typeof document === 'undefined') return;
  // One year, readable by the server components that render the SEO pages.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

/**
 * `initial` comes from the cookie the server already read, so the first paint
 * is in the right language and there is no flash of the default.
 */
export function I18nProvider({ children, initial = DEFAULT_LANG }) {
  const [lang, setLangState] = useState(normalizeLang(initial));

  // If localStorage disagrees with the cookie (e.g. cookie cleared), trust storage.
  useEffect(() => {
    let stored = null;
    try {
      stored = window.localStorage.getItem(LANG_STORAGE);
    } catch {
      /* storage unavailable */
    }
    const fromCookie = readCookie(LANG_COOKIE);
    const next = normalizeLang(stored || fromCookie || initial);
    if (next !== lang) setLangState(next);
    writeCookie(LANG_COOKIE, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = htmlLangFor(lang);
  }, [lang]);

  const setLang = useCallback((next) => {
    const code = normalizeLang(next);
    setLangState(code);
    writeCookie(LANG_COOKIE, code);
    try {
      window.localStorage.setItem(LANG_STORAGE, code);
    } catch {
      /* storage unavailable */
    }
    // Server components (SEO pages, metadata) read the cookie on the next request.
    window.dispatchEvent(new CustomEvent('hk:lang', { detail: code }));
    return code;
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Shorthand for the common case. */
export const useT = () => useI18n().t;
