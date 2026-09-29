import axios from 'axios';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
export const TOKEN_KEY = 'hk_token';

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (t) => {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && typeof window !== 'undefined' && getToken()) {
      window.dispatchEvent(new CustomEvent('hk:unauthorized'));
    }
    return Promise.reject(error);
  },
);

/**
 * Human readable error message from an axios error.
 * Pass the t() from useI18n so the fallbacks follow the chosen language; the
 * server's own message (already localised copy) always wins when present.
 */
export const errMsg = (e, fallback, t) => {
  const tr = typeof fallback === 'function' ? fallback : t;
  const say = (key, def) => (tr ? tr(key) : def);
  if (e?.code === 'ECONNABORTED') return say('common.timeout', 'Server se jawab nahi aaya, dobara try karo');
  if (!e?.response) return say('common.noConnection', 'Server se connect nahi ho paya. Internet check karo.');
  return (
    e.response.data?.message ||
    (typeof fallback === 'string' ? fallback : say('common.somethingWrong', 'Kuch gadbad ho gayi, dobara try karo'))
  );
};

/** Server-side fetch for SEO pages (never throws). */
export async function serverGet(path, { revalidate = 300 } = {}) {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default api;
