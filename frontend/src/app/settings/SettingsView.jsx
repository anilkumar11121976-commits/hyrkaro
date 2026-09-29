'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { toast } from 'react-toastify';
import api, { API_URL, errMsg, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { PageTitle, RequireAuth, UserAvatar } from '@/components/common';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { CITIES, KYC_STATUS } from '@/lib/constants';
import { date } from '@/lib/format';
import { brand } from '@/lib/theme';

const ACCOUNT_DELETE_DAYS = 30;

function KycCard() {
  const { t } = useI18n();
  const [kyc, setKyc] = useState(null);
  const [f, setF] = useState({
    legalName: '',
    pan: '',
    payoutMethod: 'upi',
    upiId: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/users/me/kyc')
      .then(({ data }) => setKyc(data.kyc))
      .catch(() => setKyc({ status: 'none' }));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        legalName: f.legalName.trim(),
        pan: f.pan.trim().toUpperCase(),
        payoutMethod: f.payoutMethod,
        ...(f.payoutMethod === 'upi'
          ? { upiId: f.upiId.trim() }
          : { accountNumber: f.accountNumber.trim(), ifsc: f.ifsc.trim().toUpperCase(), bankName: f.bankName.trim() }),
      };
      const { data } = await api.post('/users/me/kyc', payload);
      setKyc(data.kyc);
      toast.success(data.message || t('kyc.submitted'));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (!kyc) return null;
  const meta = KYC_STATUS[kyc.status] || KYC_STATUS.none;
  const done = kyc.status === 'verified' || kyc.status === 'pending';

  return (
    <Card id="kyc" sx={{ p: 3, mt: 3, scrollMarginTop: 90 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">{t('kyc.title')}</Typography>
        <Chip size="small" label={t(meta.key)} color={meta.color} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('kyc.subtitle')}
      </Typography>

      {kyc.status === 'rejected' && kyc.note && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('kyc.rejectedNote', { note: kyc.note })}
        </Alert>
      )}
      {kyc.status === 'verified' && (
        <Alert severity="success">
          {t('kyc.verifiedNote', { method: kyc.payout?.method === 'upi' ? kyc.payout.upiId : `••••${kyc.payout?.accountLast4 || ''}` })}
        </Alert>
      )}

      {!done && (
        <Stack component="form" spacing={2} onSubmit={submit}>
          <TextField label={t('kyc.legalName')} value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} />
          <TextField
            label={t('kyc.pan')}
            placeholder={t('kyc.panPlaceholder')}
            value={f.pan}
            onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase().slice(0, 10) })}
          />
          <TextField
            select
            label={t('kyc.payoutMethod')}
            value={f.payoutMethod}
            onChange={(e) => setF({ ...f, payoutMethod: e.target.value })}
          >
            <MenuItem value="upi">{t('kyc.upi')}</MenuItem>
            <MenuItem value="bank">{t('kyc.bank')}</MenuItem>
          </TextField>
          {f.payoutMethod === 'upi' ? (
            <TextField label={t('kyc.upiId')} value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} />
          ) : (
            <>
              <TextField
                label={t('kyc.accountNumber')}
                value={f.accountNumber}
                onChange={(e) => setF({ ...f, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })}
              />
              <TextField
                label={t('kyc.ifsc')}
                value={f.ifsc}
                onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase().slice(0, 11) })}
              />
              <TextField label={t('kyc.bankName')} value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} />
            </>
          )}
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? t('common.sending') : t('kyc.submit')}
          </Button>
        </Stack>
      )}
    </Card>
  );
}

function DeleteDialog({ open, onClose, onConfirm, busy }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setConfirm('');
      setReason('');
    }
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('settings.deleteConfirmTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning" icon={false}>
            {t('settings.deleteConfirmText', { days: ACCOUNT_DELETE_DAYS })}
          </Alert>
          <TextField label={t('settings.deleteReason')} multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <TextField label={t('settings.deleteTypeConfirm')} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button color="error" variant="contained" disabled={busy || confirm !== 'DELETE'} onClick={() => onConfirm(reason)}>
          {t('settings.deleteAccount')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Inner() {
  const { user, setUser, refresh, switchRole } = useAuth();
  const { t, lang } = useI18n();
  const [f, setF] = useState({ name: '', email: '', city: '', companyName: '' });
  const [busy, setBusy] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setF({ name: user.name || '', email: user.email || '', city: user.city || '', companyName: user.companyName || '' });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try {
      const payload = { ...f, lang };
      if (user.role !== 'client') delete payload.companyName;
      const { data } = await api.patch('/users/me', payload);
      setUser(data.user);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy('');
    }
  };

  const avatar = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.warn(t('settings.photoTooBig'));
    const fd = new FormData();
    fd.append('avatar', file);
    setBusy('avatar');
    try {
      const { data } = await api.post('/users/me/avatar', fd);
      setUser(data.user);
      toast.success(t('settings.photoChanged'));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy('');
    }
  };

  /** PDF §17: one JSON file with everything we hold. */
  const downloadData = async () => {
    setBusy('export');
    try {
      const res = await fetch(`${API_URL}/users/me/export`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hyrkro-data-${user._id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setBusy('');
    }
  };

  const requestDelete = async (reason) => {
    setBusy('delete');
    try {
      const { data } = await api.post('/users/me/delete', { confirm: 'DELETE', reason });
      toast.info(data.message);
      setDeleteOpen(false);
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy('');
    }
  };

  const cancelDelete = async () => {
    setBusy('delete');
    try {
      await api.post('/users/me/delete/cancel');
      toast.success(t('settings.deleteCancelled'));
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy('');
    }
  };

  const doSwitch = async (role) => {
    if (!role || role === user.role) return;
    setBusy('role');
    try {
      await switchRole(role);
      toast.success(t('nav.switchedTo', { role: role === 'client' ? t('nav.switchToClient') : t('nav.switchToFreelancer') }));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy('');
    }
  };

  const isFreelancer = user.role === 'freelancer';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageTitle title={t('settings.title')} subtitle={`+91${user.phone}`} />

      {user.deletionScheduledFor && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button size="small" onClick={cancelDelete} disabled={busy === 'delete'}>
              {t('settings.cancelDelete')}
            </Button>
          }
        >
          {t('settings.deletePending', { date: date(user.deletionScheduledFor) })}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <UserAvatar user={user} size={96} sx={{ mx: 'auto' }} />
            <Button component="label" variant="outlined" sx={{ mt: 2 }} disabled={busy === 'avatar'}>
              {busy === 'avatar' ? t('dashboard.uploading') : t('settings.changePhoto')}
              <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => avatar(e.target.files?.[0])} />
            </Button>
          </Card>

          <Card sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('settings.language')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.languageHelp')}
            </Typography>
            <LanguageSwitcher variant="buttons" size="small" />
          </Card>

          {/* PDF §2: one account, two roles */}
          {user.role !== 'admin' && (
            <Card sx={{ p: 3, mt: 3 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <SwapHorizIcon sx={{ color: brand.purple }} />
                <Typography variant="h6">{t('settings.roleSection')}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.roleHelp')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="secondary"
                value={user.role}
                onChange={(_, v) => doSwitch(v)}
                disabled={busy === 'role'}
              >
                <ToggleButton value="client">{t('nav.switchToClient')}</ToggleButton>
                <ToggleButton value="freelancer">{t('nav.switchToFreelancer')}</ToggleButton>
              </ToggleButtonGroup>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card component="form" onSubmit={save} sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('settings.account')}
            </Typography>
            <Stack spacing={2}>
              <TextField label={t('common.name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <TextField
                label={t('common.phone')}
                value={user.phone}
                disabled
                helperText={t('auth.noPassword')}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">+91</InputAdornment> } }}
              />
              <TextField
                label={t('settings.emailOptional')}
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
              <TextField select label={t('common.city')} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
                <MenuItem value="">—</MenuItem>
                {CITIES.map((c) => (
                  <MenuItem key={c.slug} value={c.slug}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              {user.role === 'client' && (
                <TextField
                  label={t('auth.companyOptional')}
                  value={f.companyName}
                  onChange={(e) => setF({ ...f, companyName: e.target.value })}
                />
              )}
              <Button type="submit" variant="contained" disabled={busy === 'profile'}>
                {busy === 'profile' ? t('common.saving') : t('common.save')}
              </Button>
            </Stack>
          </Card>

          {isFreelancer && <KycCard />}

          {/* PDF §17: data download + account delete */}
          <Card sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6">{t('settings.privacy')}</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Box>
                <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={downloadData} disabled={busy === 'export'}>
                  {busy === 'export' ? t('common.loading') : t('settings.downloadData')}
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('settings.downloadHelp')}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Button color="error" variant="outlined" onClick={() => setDeleteOpen(true)} disabled={Boolean(user.deletionScheduledFor)}>
                  {t('settings.deleteAccount')}
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('settings.deleteHelp', { days: ACCOUNT_DELETE_DAYS })}
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      <DeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={requestDelete} busy={busy === 'delete'} />
    </Container>
  );
}

export default function SettingsView() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
