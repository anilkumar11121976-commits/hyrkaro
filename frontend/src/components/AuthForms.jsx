'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { errMsg } from '@/lib/api';
import { CITIES } from '@/lib/constants';
import { Logo } from './common';
import { brand } from '@/lib/theme';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);
const onlyDigits = (v, len = 10) => String(v).replace(/\D/g, '').slice(0, len);
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** The half-finished signup survives a page reload (common on mobile). */
const DRAFT_KEY = 'hk_signup_draft';
const readDraft = () => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // The registration token is only good for 15 minutes.
    if (!d?.at || Date.now() - d.at > 14 * 60_000) return null;
    return d;
  } catch {
    return null;
  }
};
const writeDraft = (d) => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
};
const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
};

function Shell({ title, subtitle, children }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 7 } }}>
      <Card sx={{ p: { xs: 3, sm: 4 } }}>
        <Logo size={34} />
        <Typography variant="h4" component="h1" sx={{ mt: 3 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </Card>
    </Container>
  );
}

/**
 * PDF §2: browse freely; mobile + OTP to chat, hire or post. Signing up and
 * logging in are the same three steps — phone, OTP, and (only for a new number)
 * name + role. `?role=` / `?intent=signup` just changes the framing and, for an
 * existing account, switches them into the role they asked for.
 */
export function LoginForm() {
  const { requestOtp, verifyOtp, completeProfile, switchRole, user, ready } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();

  const next = safeNext(sp.get('next'));
  const wantedRole = sp.get('role') === 'freelancer' ? 'freelancer' : sp.get('role') === 'client' ? 'client' : null;
  const isSignupIntent = sp.get('intent') === 'signup' || Boolean(wantedRole);

  const [step, setStep] = useState('phone'); // phone | otp | profile
  const [phone, setPhone] = useState('');
  // OTP is emailed, not texted, so this is collected alongside the phone number.
  // Pre-filled from a previous visit (localStorage, not the phone/OTP draft below)
  // so a returning person isn't forced to retype it every login.
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(null);
  const [registrationToken, setRegistrationToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [form, setForm] = useState({
    name: '',
    role: wantedRole || 'client',
    city: '',
    companyName: '',
    acceptPolicy: false,
  });
  const otpRef = useRef(null);
  const leaving = useRef(false);

  /** Send them where they were going, honouring ?next for both roles. */
  const goOn = useCallback(
    (role) => {
      leaving.current = true;
      clearDraft();
      router.replace(next || (role === 'admin' ? '/admin' : role === 'freelancer' ? '/dashboard' : '/freelancers'));
    },
    [next, router],
  );

  // Already signed in: honour the role they asked for, then move on.
  useEffect(() => {
    if (!ready || !user || leaving.current) return;
    (async () => {
      if (wantedRole && user.role !== 'admin' && user.role !== wantedRole) {
        try {
          await switchRole(wantedRole);
          toast.info(t('auth.switchedForYou'));
        } catch {
          /* stay in the current role */
        }
      }
      goOn(wantedRole || user.role);
    })();
  }, [ready, user, wantedRole, switchRole, goOn, t]);

  // Restore a half-finished signup after a reload.
  useEffect(() => {
    const d = readDraft();
    if (d?.email) setEmail(d.email);
    else {
      try {
        const remembered = localStorage.getItem('hk_email');
        if (remembered) setEmail(remembered);
      } catch {
        /* storage unavailable */
      }
    }
    if (!d?.phone) return;
    setPhone(d.phone);
    setIsNewUser(d.isNewUser ?? null);
    if (d.registrationToken) {
      setRegistrationToken(d.registrationToken);
      setStep('profile');
    } else {
      setStep('otp');
    }
  }, []);

  useEffect(() => {
    if (!cooldown) return undefined;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.warn(t('auth.phoneInvalid'));
    if (!isValidEmail(email)) return toast.warn(t('auth.emailInvalid'));
    setBusy(true);
    try {
      const d = await requestOtp(phone, email);
      setStep('otp');
      setCooldown(30);
      setDemoCode(d.demoCode || '');
      setIsNewUser(Boolean(d.isNewUser));
      setCode('');
      writeDraft({ phone, email, isNewUser: Boolean(d.isNewUser) });
      try {
        localStorage.setItem('hk_email', email);
      } catch {
        /* storage unavailable */
      }
      toast.success(t('auth.otpSentTo', { email }));
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e) => {
    e?.preventDefault();
    if (code.length < 4) return;
    setBusy(true);
    try {
      const d = await verifyOtp({ phone, code, lang });
      if (d.needsProfile) {
        setRegistrationToken(d.registrationToken || '');
        writeDraft({ phone, email, isNewUser: true, registrationToken: d.registrationToken });
        setStep('profile');
        return;
      }
      // Existing account. The role switch (if they asked for one) happens in the
      // effect above once `user` lands, so just greet them here.
      toast.success(t('auth.welcomeBack', { name: d.user.name.split(' ')[0] }));
      clearDraft();
    } catch (err) {
      toast.error(errMsg(err, t));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = async (e) => {
    e?.preventDefault();
    if (!form.acceptPolicy) return toast.warn(t('auth.mustAccept'));
    if (form.name.trim().length < 2) return toast.warn(t('auth.yourName'));
    if (!registrationToken) {
      toast.error(t('auth.sessionExpired'));
      clearDraft();
      setStep('phone');
      return;
    }
    setBusy(true);
    try {
      await completeProfile({
        registrationToken,
        name: form.name.trim(),
        role: form.role,
        city: form.city,
        acceptPolicy: true,
        lang,
        ...(form.role === 'client' && form.companyName ? { companyName: form.companyName } : {}),
      });
      toast.success(form.role === 'freelancer' ? t('auth.accountReadyFreelancer') : t('auth.accountReadyClient'));
      goOn(form.role);
    } catch (err) {
      toast.error(errMsg(err, t));
      // An expired token means starting over, so say that rather than looping.
      if (/session|otp/i.test(err?.response?.data?.message || '')) {
        clearDraft();
        setStep('phone');
      }
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    clearDraft();
    setStep('phone');
    setCode('');
    setRegistrationToken('');
    setIsNewUser(null);
  };

  /* ---------------- step 1: phone ---------------- */
  if (step === 'phone') {
    return (
      <Shell
        title={isSignupIntent ? t('auth.signupTitle') : t('auth.loginTitle')}
        subtitle={isSignupIntent ? t('auth.signupSubtitle') : t('auth.loginSubtitle')}
      >
        <Stack component="form" spacing={2} onSubmit={sendOtp} noValidate>
          {wantedRole === 'freelancer' && (
            <Alert severity="info" icon={false}>
              {t('auth.freelancerIntent')}
            </Alert>
          )}
          <TextField
            label={t('auth.phoneLabel')}
            helperText={t('auth.phoneHelp')}
            autoComplete="tel"
            autoFocus
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">+91</InputAdornment> } }}
          />
          <TextField
            label={t('auth.emailLabel')}
            helperText={t('auth.emailHelp')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={busy || phone.length !== 10 || !isValidEmail(email)}
          >
            {busy ? t('auth.sendingOtp') : t('auth.sendOtp')}
          </Button>
          <Typography variant="body2" color="text.secondary" align="center">
            {t('auth.noPassword')}
          </Typography>
          <Typography variant="body2" align="center">
            <Box component={Link} href="/admin/login" sx={{ color: 'text.secondary' }}>
              {t('auth.adminLogin')}
            </Box>
          </Typography>
        </Stack>
      </Shell>
    );
  }

  /* ---------------- step 2: OTP ---------------- */
  if (step === 'otp') {
    return (
      <Shell title={isSignupIntent ? t('auth.signupTitle') : t('auth.loginTitle')} subtitle={t('auth.otpSentTo', { email })}>
        <Stack component="form" spacing={2} onSubmit={submitOtp} noValidate>
          {isNewUser !== null && (
            <Alert severity={isNewUser ? 'info' : 'success'} icon={false}>
              {isNewUser ? t('auth.newAccountNote') : t('auth.welcomeBackNote')}
            </Alert>
          )}
          {demoCode && (
            <Alert severity="warning" icon={false}>
              <b>{t('auth.otpDemoNotice')}</b>
              <br />
              {t('auth.demoCodeIs', { code: demoCode })}
            </Alert>
          )}
          <TextField
            inputRef={otpRef}
            label={t('auth.otpLabel')}
            autoComplete="one-time-code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(onlyDigits(e.target.value, 6))}
            slotProps={{ htmlInput: { style: { fontSize: 28, letterSpacing: 10, textAlign: 'center' } } }}
          />
          <Button type="submit" variant="contained" size="large" disabled={busy || code.length < 4}>
            {busy ? t('auth.verifying') : t('auth.verify')}
          </Button>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Button size="small" color="inherit" onClick={restart}>
              {t('auth.changeNumber')}
            </Button>
            <Button size="small" onClick={sendOtp} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? t('auth.resendIn', { sec: cooldown }) : t('auth.resend')}
            </Button>
          </Stack>
        </Stack>
      </Shell>
    );
  }

  /* ---------------- step 3: new account details ---------------- */
  return (
    <Shell title={t('auth.completeProfile')} subtitle={t('auth.completeProfileSub')}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={form.role}
        onChange={(_, v) => v && setForm((f) => ({ ...f, role: v }))}
        sx={{ mb: 2.5 }}
        color="secondary"
      >
        <ToggleButton value="client">{t('auth.iAmClient')}</ToggleButton>
        <ToggleButton value="freelancer">{t('auth.iAmFreelancer')}</ToggleButton>
      </ToggleButtonGroup>
      <Stack component="form" spacing={2} onSubmit={submitProfile} noValidate>
        <TextField
          label={t('auth.yourName')}
          autoComplete="name"
          autoFocus
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <TextField select label={t('common.city')} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
          <MenuItem value="">—</MenuItem>
          {CITIES.map((c) => (
            <MenuItem key={c.slug} value={c.slug}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        {form.role === 'client' && (
          <TextField
            label={t('auth.companyOptional')}
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          />
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={form.acceptPolicy}
              onChange={(e) => setForm((f) => ({ ...f, acceptPolicy: e.target.checked }))}
              color="secondary"
            />
          }
          label={
            <Typography variant="body2">
              {t('auth.acceptPre')}{' '}
              <Box component={Link} href="/terms" target="_blank" sx={{ color: 'secondary.main' }}>
                {t('auth.acceptTerms')}
              </Box>{' '}
              {t('auth.acceptAnd')}{' '}
              <Box component={Link} href="/privacy" target="_blank" sx={{ color: 'secondary.main' }}>
                {t('auth.acceptPrivacy')}
              </Box>
              {t('auth.acceptPost')}
            </Typography>
          }
        />
        <Button type="submit" variant="contained" size="large" disabled={busy}>
          {busy ? t('auth.creating') : t('auth.createAccount')}
        </Button>
        <Button size="small" color="inherit" onClick={restart} disabled={busy}>
          {t('auth.changeNumber')}
        </Button>
      </Stack>
    </Shell>
  );
}

/** Admins still use email + password (PDF §2 removes passwords for everyone else). */
export function AdminLoginForm() {
  const { adminLogin, user, ready } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user?.role === 'admin') router.replace('/admin');
  }, [ready, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await adminLogin(form.email.trim(), form.password);
      toast.success(t('auth.welcomeBack', { name: d.user.name.split(' ')[0] }));
      router.replace('/admin');
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={t('auth.adminLogin')} subtitle={t('auth.adminLoginSub')}>
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        <TextField
          label={t('common.email')}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" variant="contained" size="large" disabled={busy}>
          {busy ? t('common.loading') : t('auth.loginButton')}
        </Button>
        <Typography variant="body2" align="center">
          <Box component={Link} href="/login" sx={{ color: brand.purple }}>
            {t('auth.loginTitle')} (OTP)
          </Box>
        </Typography>
      </Stack>
    </Shell>
  );
}