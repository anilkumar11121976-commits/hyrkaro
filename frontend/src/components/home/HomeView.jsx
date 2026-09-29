'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Card, Chip, Container, Grid, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import FreelancerCard from '@/components/FreelancerCard';
import { CATEGORIES, CITIES, cityName, localPath } from '@/lib/constants';
import { useI18n } from '@/i18n/I18nProvider';
import { brand } from '@/lib/theme';

const WHY = [
  [PlaceOutlinedIcon, 'home.whyCity', 'home.whyCityDesc'],
  [VerifiedUserOutlinedIcon, 'home.whyVerified', 'home.whyVerifiedDesc'],
  [LockOutlinedIcon, 'home.whyEscrow', 'home.whyEscrowDesc'],
  [FlagOutlinedIcon, 'home.whyMilestones', 'home.whyMilestonesDesc'],
  [VideocamOutlinedIcon, 'home.whyChat', 'home.whyChatDesc'],
  [CurrencyRupeeIcon, 'home.whyNoFee', 'home.whyNoFeeDesc'],
];

const STEPS = [
  ['1', 'home.step1', 'home.step1Desc'],
  ['2', 'home.step2', 'home.step2Desc'],
  ['3', 'home.step3', 'home.step3Desc'],
];

export default function HomeView({ top = [] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [city, setCity] = useState('noida');
  const [q, setQ] = useState('');

  const search = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (city) p.set('city', city);
    if (q.trim()) p.set('q', q.trim());
    router.push(`/freelancers?${p.toString()}`);
  };

  return (
    <>
      {/* HERO */}
      <Box sx={{ background: `linear-gradient(180deg, ${brand.soft} 0%, #fff 100%)`, pt: { xs: 5, md: 8 }, pb: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip label={t('home.heroBadge')} sx={{ bgcolor: '#fff', border: `1px solid ${brand.line}`, mb: 2 }} />
              <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 38, md: 56 }, lineHeight: 1.05 }}>
                {t('home.heroTitle')} <Box component="span" sx={{ color: brand.purple }}>{t('home.heroTitleAccent')}</Box>
              </Typography>
              <Typography sx={{ mt: 2, fontSize: 19, color: 'text.secondary', maxWidth: 560 }}>
                {t('home.heroSub')}
              </Typography>
              <Paper component="form" onSubmit={search} variant="outlined" sx={{ mt: 3, p: 1, display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, borderRadius: 3 }}>
                <TextField select size="small" value={city} onChange={(e) => setCity(e.target.value)} sx={{ minWidth: 170, width: { sm: 190 } }} label={t('common.city')}>
                  {CITIES.map((c) => (
                    <MenuItem key={c.slug} value={c.slug}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.searchWorkPlaceholder')} label={t('home.searchWorkLabel')} />
                <Button type="submit" variant="contained" size="large" startIcon={<SearchIcon />} sx={{ px: 3, flexShrink: 0 }}>
                  {t('common.search')}
                </Button>
              </Paper>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
                {[t('home.chipVerified'), t('home.chipNoFee'), t('home.chipPayout')].map((label) => (
                  <Chip key={label} label={label} size="small" sx={{ bgcolor: '#fff', border: `1px solid ${brand.line}` }} />
                ))}
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box component="img" src="/mascot.svg" alt="HyrKro mascot" sx={{ width: { xs: 220, md: 360 }, maxWidth: '100%' }} />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CATEGORIES */}
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography variant="h4" component="h2">
          {t('home.whatWork', { city: cityName(city) })}
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {CATEGORIES.map((c) => (
            <Grid key={c.slug} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card sx={{ height: '100%', '&:hover': { borderColor: brand.purple } }}>
                <Box component={Link} href={localPath(c.slug, city)} sx={{ display: 'block', p: 2.25, height: '100%' }}>
                  <Typography sx={{ fontSize: 28 }} aria-hidden>
                    {c.emoji}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, mt: 1 }}>{c.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.seeIn', { city: cityName(city) })}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* HOW IT WORKS */}
      <Box sx={{ bgcolor: '#FAF8FF', py: { xs: 5, md: 7 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2">
            {t('home.howItWorks')}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {STEPS.map(([n, titleKey, descKey]) => (
              <Grid key={n} size={{ xs: 12, md: 4 }}>
                <Card sx={{ p: 3, height: '100%' }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: brand.lilac, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{n}</Box>
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    {t(titleKey)}
                  </Typography>
                  <Typography color="text.secondary">{t(descKey)}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* TOP FREELANCERS */}
      {top.length > 0 && (
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h4" component="h2">
              {t('home.topFreelancers')}
            </Typography>
            <Button component={Link} href="/freelancers" color="secondary">
              {t('home.seeAll')}
            </Button>
          </Stack>
          <Grid container spacing={2}>
            {top.slice(0, 8).map((p) => (
              <Grid key={p._id} size={{ xs: 12, sm: 6, md: 3 }}>
                <FreelancerCard p={p} />
              </Grid>
            ))}
          </Grid>
        </Container>
      )}

      {/* WHY */}
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography variant="h4" component="h2">
          {t('home.whyHyrkro')}
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {WHY.map(([Icon, titleKey, descKey]) => (
            <Grid key={titleKey} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ p: 2.5, height: '100%' }}>
                <Icon sx={{ color: brand.purple }} />
                <Typography sx={{ fontWeight: 700, mt: 1 }}>{t(titleKey)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(descKey)}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* FREELANCER CTA */}
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: brand.ink, color: '#fff', borderRadius: 4, p: { xs: 3, md: 5 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" component="h2">
              {t('home.ctaTitle')} <Box component="span" sx={{ color: brand.lilac }}>{t('home.ctaAccent')}</Box>
            </Typography>
            <Typography sx={{ color: '#D9D4E4', mt: 1 }}>
              {t('home.ctaSub', { pro: 5, free: 10, days: 3 })}
            </Typography>
          </Box>
          <Button component={Link} href="/login?role=freelancer" variant="contained" size="large" sx={{ bgcolor: brand.lilac, color: brand.ink, '&:hover': { bgcolor: '#fff' } }}>
            {t('home.ctaButton')}
          </Button>
        </Box>
      </Container>
    </>
  );
}
