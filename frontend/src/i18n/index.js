import hinglish from './dictionaries/hinglish';
import hi from './dictionaries/hi';
import en from './dictionaries/en';

export const LANG_COOKIE = 'hk_lang';
export const LANG_STORAGE = 'hk_lang';
export const DEFAULT_LANG = 'hinglish';

export const DICTS = { hinglish, hi, en };

export const LANGUAGES = [
  { code: 'hinglish', name: 'Hinglish', short: 'HI-EN', htmlLang: 'en-IN' },
  { code: 'hi', name: 'हिंदी', short: 'हि', htmlLang: 'hi-IN' },
  { code: 'en', name: 'English', short: 'EN', htmlLang: 'en-IN' },
];

export const isLang = (v) => LANGUAGES.some((l) => l.code === v);
export const normalizeLang = (v) => (isLang(v) ? v : DEFAULT_LANG);
export const htmlLangFor = (code) => LANGUAGES.find((l) => l.code === code)?.htmlLang || 'en-IN';

/**
 * Look a key up as "namespace.key", fall back to Hinglish, then to the key
 * itself — a missing string shows the key rather than blanking the UI.
 */
export function lookup(dict, key) {
  const parts = String(key).split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function fill(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Translate for a known language code. Used on the server and the client. */
export function translate(langCode, key, vars) {
  const code = normalizeLang(langCode);
  const hit = lookup(DICTS[code], key) ?? lookup(DICTS[DEFAULT_LANG], key);
  if (hit === undefined) {
    if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return fill(hit, vars);
}

/** A bound t() for server components, which have no React context. */
export const makeT = (langCode) => (key, vars) => translate(langCode, key, vars);
