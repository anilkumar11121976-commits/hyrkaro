'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
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
import api, { errMsg } from '@/lib/api';
import { CATEGORIES, CITIES } from '@/lib/constants';
import { useI18n } from '@/i18n/I18nProvider';
import { brand } from '@/lib/theme';

export default function WaitlistView() {
  const { t } = useI18n();
  const [f, setF] = useState({ name: '', email: '', phone: '', type: 'freelancer', city: 'noida', category: '', acceptPolicy: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!f.acceptPolicy) {
        setBusy(false);
        return toast.warn(t('auth.mustAccept'));
      }
      const payload = { ...f, source: 'website', acceptPolicy: true };
      if (!payload.phone) delete payload.phone;
      if (!payload.category) delete payload.category;
      const { data } = await api.post('/waitlist', payload);
      toast.success(data.message);
      setDone(true);
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 7 } }}>
      <Card sx={{ p: { xs: 3, sm: 4 } }}>
        <Box component="img" src="/mascot.svg" alt="" sx={{ width: 110 }} />
        <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
          {t('waitlist.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
          {t('waitlist.subtitle')}
        </Typography>
        {done ? (
          <Box sx={{ bgcolor: brand.soft, p: 2.5, borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{t('waitlist.doneTitle')}</Typography>
            <Typography color="text.secondary">{t('waitlist.doneText')}</Typography>
          </Box>
        ) : (
          <Stack component="form" spacing={2} onSubmit={submit}>
            <ToggleButtonGroup exclusive fullWidth color="secondary" value={f.type} onChange={(_, v) => v && setF({ ...f, type: v })}>
              <ToggleButton value="freelancer">{t('waitlist.iAmFreelancer')}</ToggleButton>
              <ToggleButton value="client">{t('waitlist.iNeedFreelancer')}</ToggleButton>
            </ToggleButtonGroup>
            <TextField label={t('common.name')} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <TextField label={t('common.email')} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <TextField
              label={`${t('common.phone')} (${t('common.optional')})`}
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">+91</InputAdornment> } }}
            />
            <TextField select label={t('common.city')} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
              {CITIES.map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={f.type === 'freelancer' ? t('waitlist.yourWork') : t('waitlist.whichWork')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <MenuItem value="">{t('waitlist.notDecided')}</MenuItem>
              {CATEGORIES.map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={f.acceptPolicy}
                  onChange={(e) => setF({ ...f, acceptPolicy: e.target.checked })}
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
            <Button type="submit" variant="contained" size="large" disabled={busy || !f.acceptPolicy}>
              {busy ? t('waitlist.joining') : t('waitlist.join')}
            </Button>
          </Stack>
        )}
      </Card>
    </Container>
  );
}
