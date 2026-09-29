'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api, { getToken, setToken } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [token, setTok] = useState(null);
  const [ready, setReady] = useState(false);
  const { t, setLang } = useI18n();

  const applySession = useCallback(
    (data) => {
      if (data.token) {
        setToken(data.token);
        setTok(data.token);
      }
      if (data.user) {
        setUser(data.user);
        // The account remembers a language; follow it on login.
        if (data.user.lang) setLang(data.user.lang);
      }
      if (data.profile !== undefined) setProfile(data.profile);
      if (data.roles) setRoles(data.roles);
    },
    [setLang],
  );

  const logout = useCallback(
    (silent = false) => {
      setToken(null);
      setTok(null);
      setUser(null);
      setProfile(null);
      setRoles([]);
      if (!silent) toast.info(t('auth.loggedOut'));
    },
    [t],
  );

  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setProfile(data.profile);
    setRoles(data.roles || []);
    return data;
  }, []);

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setReady(true);
      return;
    }
    setTok(stored);
    refresh()
      .catch(() => logout(true))
      .finally(() => setReady(true));
  }, [refresh, logout]);

  useEffect(() => {
    const onUnauthorized = () => {
      logout(true);
      toast.warn(t('auth.sessionExpired'));
    };
    window.addEventListener('hk:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hk:unauthorized', onUnauthorized);
  }, [logout, t]);

  /* ---------------- OTP login (PDF §2) ---------------- */

  const requestOtp = useCallback(async (phone) => {
    const { data } = await api.post('/auth/otp/request', { phone });
    return data;
  }, []);

  const verifyOtp = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/otp/verify', payload);
      if (data.token) applySession(data);
      return data;
    },
    [applySession],
  );

  const completeProfile = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/complete-profile', payload);
      applySession(data);
      return data;
    },
    [applySession],
  );

  const adminLogin = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/admin/login', { email, password });
      applySession(data);
      return data;
    },
    [applySession],
  );

  /** PDF §2: one account, switch between client and freelancer. */
  const switchRole = useCallback(
    async (role) => {
      const { data } = await api.post('/auth/switch-role', { role });
      applySession(data);
      return data;
    },
    [applySession],
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      roles,
      token,
      ready,
      requestOtp,
      verifyOtp,
      completeProfile,
      adminLogin,
      switchRole,
      logout,
      refresh,
      setUser,
      setProfile,
      applySession,
    }),
    [user, profile, roles, token, ready, requestOtp, verifyOtp, completeProfile, adminLogin, switchRole, logout, refresh, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
