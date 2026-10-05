'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Container,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { toast } from '@/lib/toast';
import api, { errMsg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { PageTitle } from '@/components/common';
import { CATEGORIES, CITIES, KYC_STATUS, MAX_UPLOAD_MB, RATE_UNITS, RATE_UNIT_KEY } from '@/lib/constants';
import { date, inr } from '@/lib/format';
import { brand } from '@/lib/theme';

const VSTATUS = {
  incomplete: ['dashboard.vIncomplete', 'default'],
  pending: ['dashboard.vPending', 'warning'],
  verified: ['dashboard.vVerified', 'success'],
  rejected: ['dashboard.vRejected', 'error'],
};

const SKILL_HINTS = [
  'React', 'Node.js', 'WordPress', 'Shopify', 'Figma', 'Canva', 'Logo Design', 'SEO',
  'Google Ads', 'Meta Ads', 'Reels', 'Video Editing', 'Copywriting', 'Excel', 'Instagram',
];

function Stat({ label, value }) {
  return (
    <Card sx={{ p: 2, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Card>
  );
}

export default function FreelancerDashboard() {
  const { user, profile, setProfile } = useAuth();
  const { t } = useI18n();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [kyc, setKyc] = useState(null);

  useEffect(() => {
    api
      .get('/freelancers/me/profile')
      .then(({ data }) => setProfile(data.profile))
      .catch(() => {});
    api
      .get('/orders', { params: { limit: 50 } })
      .then(({ data }) => setOrders(data.items))
      .catch(() => {});
    api
      .get('/users/me/kyc')
      .then(({ data }) => setKyc(data.kyc))
      .catch(() => {});
  }, [setProfile]);

  useEffect(() => {
    if (!profile) return;
    setF({
      title: profile.title || '',
      category: profile.category || '',
      city: profile.city || user?.city || '',
      area: profile.area || '',
      bio: profile.bio || '',
      skills: profile.skills || [],
      languages: profile.languages || [],
      experienceYears: profile.experienceYears ?? 0,
      rate: { amount: profile.rate?.amount || '', unit: profile.rate?.unit || 'project' },
      remoteOk: profile.remoteOk ?? true,
      isVisible: profile.isVisible ?? true,
    });
    // Re-initialise only when a different profile loads (keeps unsaved edits on uploads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?._id]);

  const earnings = useMemo(() => {
    let due = 0;
    let paid = 0;
    let onHold = 0;
    let active = 0;
    orders.forEach((o) => {
      if (o.status === 'active') active += 1;
      o.milestones.forEach((m) => {
        if (m.payout?.status === 'due') due += m.payout.amount || 0;
        if (m.payout?.status === 'on_hold') onHold += m.payout.amount || 0;
        if (m.payout?.status === 'paid') paid += m.payout.amount || 0;
      });
    });
    return { due, paid, onHold, active };
  }, [orders]);

  if (!profile || !f) return <LinearProgress color="secondary" />;

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [vKey, vColor] = VSTATUS[profile.verification?.status] || VSTATUS.incomplete;
  const proActive = profile.isPro;
  const commission = profile.commissionPercent ?? (proActive ? 5 : 10);
  const kycStatus = kyc?.status || 'none';
  const kycMeta = KYC_STATUS[kycStatus] || KYC_STATUS.none;

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...f,
        experienceYears: Number(f.experienceYears) || 0,
        rate: { amount: Number(f.rate.amount) || 0, unit: f.rate.unit },
      };
      if (!payload.category) delete payload.category;
      if (!payload.city) delete payload.city;
      const { data } = await api.put('/freelancers/me/profile', payload);
      setProfile(data.profile);
      toast.success(t('dashboard.profileSaved'));
      return true;
    } catch (err) {
      toast.error(errMsg(err, t));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitVerification = async () => {
    if (!(await save())) return;
    try {
      const { data } = await api.post('/freelancers/me/submit-verification');
      setProfile(data.profile);
      toast.success(data.message);
    } catch (err) {
      toast.error(errMsg(err, t));
    }
  };

  const upload = async (files) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 5);
    if (list.some((x) => x.size > MAX_UPLOAD_MB * 1024 * 1024)) return toast.warn(t('chat.fileTooBig', { mb: MAX_UPLOAD_MB }));
    const fd = new FormData();
    list.forEach((x) => fd.append('files', x));
    setUploading(true);
    try {
      const { data } = await api.post('/freelancers/me/portfolio', fd);
      setProfile(data.profile);
      toast.success(t('dashboard.portfolioAdded'));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (itemId) => {
    try {
      const { data } = await api.delete(`/freelancers/me/portfolio/${itemId}`);
      setProfile(data.profile);
      toast.info(t('dashboard.removed'));
    } catch (err) {
      toast.error(errMsg(err, t));
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <PageTitle
        title={t('dashboard.greeting', { name: user.name.split(' ')[0] })}
        subtitle={t('dashboard.freelancerSub')}
        action={
          <Button component={Link} href={`/freelancers/${profile._id}`} variant="outlined">
            {t('dashboard.publicProfile')}
          </Button>
        }
      />

      {/* PDF §12: no payout without KYC */}
      {kycStatus !== 'verified' && (
        <Alert
          severity={kycStatus === 'rejected' ? 'error' : 'warning'}
          icon={<VerifiedUserOutlinedIcon />}
          sx={{ mb: 3 }}
          action={
            <Button component={Link} href="/settings#kyc" size="small" variant="contained">
              {t('dashboard.completeKyc')}
            </Button>
          }
        >
          <b>{t('dashboard.kycNeeded')}</b> — {t('dashboard.kycNeededDesc')}
          {kycStatus === 'rejected' && kyc?.note ? ` ${t('kyc.rejectedNote', { note: kyc.note })}` : ''}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Stat label={t('dashboard.activeOrders')} value={earnings.active} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Stat
            label={t('dashboard.payoutComing')}
            value={
              <>
                {inr(earnings.due)}
                {earnings.onHold > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    +{inr(earnings.onHold)} {t('admin.payoutHold', { reason: 'KYC' })}
                  </Typography>
                )}
              </>
            }
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Stat label={t('dashboard.totalEarned')} value={inr(earnings.paid)} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ p: 2, height: '100%', bgcolor: proActive ? brand.ink : undefined, color: proActive ? '#fff' : undefined }}>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {t('dashboard.plan')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5 }}>
              {proActive ? t('dashboard.planPro') : t('dashboard.planFree')}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {proActive
                ? t('dashboard.proUntil', { date: date(profile.plan?.proUntil), pct: commission })
                : t('dashboard.freeCommission', { pct: commission })}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
              <Typography sx={{ fontWeight: 700 }}>{t('dashboard.profileComplete', { pct: profile.completeness })}</Typography>
              <Chip size="small" label={t(vKey)} color={vColor} />
              <Chip size="small" label={t(kycMeta.key)} color={kycMeta.color} variant="outlined" />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={profile.completeness}
              color="secondary"
              sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: brand.soft }}
            />
            {profile.verification?.status === 'rejected' && profile.verification.note && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {profile.verification.note}
              </Alert>
            )}
          </Box>
          {['incomplete', 'rejected'].includes(profile.verification?.status) && (
            <Button variant="contained" color="secondary" onClick={submitVerification} disabled={saving}>
              {t('dashboard.submitVerification')}
            </Button>
          )}
        </Stack>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card component="form" onSubmit={save} sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('dashboard.profileDetails')}
            </Typography>
            <Stack spacing={2}>
              <TextField
                label={t('dashboard.headline')}
                placeholder={t('dashboard.headlinePlaceholder')}
                value={f.title}
                onChange={set('title')}
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label={t('common.category')} value={f.category} onChange={set('category')}>
                  {CATEGORIES.map((c) => (
                    <MenuItem key={c.slug} value={c.slug}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={t('dashboard.experience')}
                  type="number"
                  value={f.experienceYears}
                  onChange={set('experienceYears')}
                  slotProps={{ htmlInput: { min: 0, max: 60 } }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label={t('common.city')} value={f.city} onChange={set('city')}>
                  {CITIES.map((c) => (
                    <MenuItem key={c.slug} value={c.slug}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={t('dashboard.areaLabel')}
                  placeholder={t('dashboard.areaPlaceholder')}
                  value={f.area}
                  onChange={set('area')}
                />
              </Stack>
              <TextField
                label={t('dashboard.aboutYou')}
                multiline
                minRows={5}
                value={f.bio}
                onChange={set('bio')}
                helperText={t('dashboard.aboutHelp', { len: f.bio.length })}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
              <Autocomplete
                multiple
                freeSolo
                options={SKILL_HINTS}
                value={f.skills}
                onChange={(_, v) => setF((s) => ({ ...s, skills: v.slice(0, 15) }))}
                renderInput={(params) => (
                  <TextField {...params} label={t('dashboard.skillsLabel')} placeholder={t('dashboard.skillsPlaceholder')} />
                )}
              />
              <Autocomplete
                multiple
                freeSolo
                options={['Hindi', 'English', 'Punjabi', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Gujarati', 'Kannada']}
                value={f.languages}
                onChange={(_, v) => setF((s) => ({ ...s, languages: v.slice(0, 8) }))}
                renderInput={(params) => <TextField {...params} label={t('dashboard.languagesLabel')} />}
              />
              <Typography sx={{ fontWeight: 600 }}>{t('dashboard.yourCharges')}</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label={t('common.amount')}
                  type="number"
                  value={f.rate.amount}
                  onChange={(e) => setF((s) => ({ ...s, rate: { ...s.rate, amount: e.target.value } }))}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                    htmlInput: { min: 0 },
                  }}
                />
                <TextField
                  select
                  label={t('dashboard.rateUnit')}
                  value={f.rate.unit}
                  onChange={(e) => setF((s) => ({ ...s, rate: { ...s.rate, unit: e.target.value } }))}
                >
                  {RATE_UNITS.map((u) => (
                    <MenuItem key={u} value={u}>
                      {t(RATE_UNIT_KEY[u])}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <FormControlLabel
                control={
                  <Switch checked={f.remoteOk} onChange={(e) => setF((s) => ({ ...s, remoteOk: e.target.checked }))} color="secondary" />
                }
                label={t('dashboard.remoteWork')}
              />
              <FormControlLabel
                control={
                  <Switch checked={f.isVisible} onChange={(e) => setF((s) => ({ ...s, isVisible: e.target.checked }))} color="secondary" />
                }
                label={t('dashboard.showInSearch')}
              />
              <Button type="submit" variant="contained" size="large" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6">{t('profile.portfolio')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('dashboard.portfolioHelp')}
            </Typography>
            <Button component="label" variant="outlined" fullWidth startIcon={<CloudUploadOutlinedIcon />} disabled={uploading}>
              {uploading ? t('dashboard.uploading') : t('dashboard.uploadFiles')}
              <input hidden type="file" multiple accept="image/*,application/pdf,video/mp4" onChange={(e) => upload(e.target.files)} />
            </Button>
            {uploading && <LinearProgress color="secondary" sx={{ mt: 1 }} />}
            <Grid container spacing={1.5} sx={{ mt: 1 }}>
              {profile.portfolio.map((it) => (
                <Grid key={it._id} size={6}>
                  <Box sx={{ position: 'relative', border: `1px solid ${brand.line}`, borderRadius: 2, overflow: 'hidden' }}>
                    {it.resourceType === 'image' ? (
                      <Box
                        component="img"
                        src={it.url}
                        alt={it.title}
                        sx={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Stack
                        component="a"
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ alignItems: 'center', justifyContent: 'center', aspectRatio: '4/3', p: 1 }}
                      >
                        <InsertDriveFileOutlinedIcon />
                        <Typography variant="caption" noWrap sx={{ maxWidth: '100%' }}>
                          {it.title}
                        </Typography>
                      </Stack>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => remove(it._id)}
                      sx={{ position: 'absolute', top: 4, right: 4, bgcolor: '#fff', '&:hover': { bgcolor: '#fff' } }}
                      aria-label={t('common.remove')}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Card>
          <Card sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6">{t('dashboard.paymentHow')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('dashboard.paymentHowDesc', { pct: commission, days: 3 })}
            </Typography>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
