'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  FormControlLabel,
  Grid,
  MenuItem,
  Pagination,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import api, { errMsg } from '@/lib/api';
import FreelancerCard from '@/components/FreelancerCard';
import { EmptyState, Loading } from '@/components/common';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORIES, CITIES, cityName, catName, regionOf } from '@/lib/constants';
import { brand } from '@/lib/theme';

const SORTS = [
  ['rating', 'search.sortRating'],
  ['price_low', 'search.sortPriceLow'],
  ['price_high', 'search.sortPriceHigh'],
  ['new', 'search.sortNew'],
  ['delivery', 'search.sortDelivery'],
];

/** PDF §3: results arrive already grouped — your city, then region, then remote. */
function TierHeading({ tier, city, region, t }) {
  const label =
    tier === 'city'
      ? t('search.tierCity', { city: cityName(city) })
      : tier === 'region'
        ? t('search.tierRegion', { region })
        : t('search.tierIndia');
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 3, mb: 1.5 }}>
      <PlaceOutlinedIcon sx={{ fontSize: 20, color: brand.purple }} />
      <Typography variant="h6" component="h2">
        {label}
      </Typography>
    </Stack>
  );
}

export default function SearchView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    q: sp.get('q') || '',
    city: sp.get('city') || '',
    category: sp.get('category') || '',
    maxRate: sp.get('maxRate') || '',
    sort: sp.get('sort') || 'rating',
    remoteOnly: sp.get('remoteOnly') === '1',
  });
  const page = Number(sp.get('page') || 1);
  const [state, setState] = useState({ loading: true, items: [], total: 0, pages: 1, error: '', cityFirst: false, region: '' });

  useEffect(() => {
    const params = {};
    for (const k of ['q', 'city', 'category', 'maxRate', 'sort']) if (sp.get(k)) params[k] = sp.get(k);
    if (sp.get('remoteOnly') === '1') params.remoteOnly = true;
    params.page = page;
    params.limit = 12;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api
      .get('/freelancers', { params })
      .then(({ data }) => {
        if (!alive) return;
        setState({
          loading: false,
          items: data.items,
          total: data.total,
          pages: data.pages,
          error: '',
          cityFirst: Boolean(data.cityFirst),
          region: data.region || '',
        });
      })
      .catch((e) => alive && setState({ loading: false, items: [], total: 0, pages: 1, error: errMsg(e, t), cityFirst: false, region: '' }));
    return () => {
      alive = false;
    };
  }, [sp, page, t]);

  const apply = (e, override = {}) => {
    e?.preventDefault();
    const next = { ...form, ...override };
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (k === 'remoteOnly') {
        if (v) p.set(k, '1');
      } else if (v) p.set(k, v);
    });
    router.push(`/freelancers?${p.toString()}`);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const heading = [sp.get('category') && catName(sp.get('category')), sp.get('city') && `in ${cityName(sp.get('city'))}`]
    .filter(Boolean)
    .join(' ');

  // Insert a heading whenever the tier changes as we walk the list.
  let lastTier = null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        {heading || t('search.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {state.loading ? t('common.searching') : t('search.found', { count: state.total })}
      </Typography>
      {state.cityFirst && !state.loading && (
        <Chip size="small" sx={{ mb: 2, bgcolor: brand.soft, color: brand.deep }} label={t('search.tierCityHelp')} />
      )}

      <Card component="form" onSubmit={apply} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField size="small" label={t('search.skillLabel')} value={form.q} onChange={set('q')} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField select size="small" label={t('common.city')} value={form.city} onChange={set('city')}>
              <MenuItem value="">{t('search.allCities')}</MenuItem>
              {CITIES.map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2.5 }}>
            <TextField select size="small" label={t('common.category')} value={form.category} onChange={set('category')}>
              <MenuItem value="">{t('search.allCategories')}</MenuItem>
              {CATEGORIES.map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <TextField
              size="small"
              label={t('search.maxBudget')}
              type="number"
              value={form.maxRate}
              onChange={set('maxRate')}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 1.8 }}>
            <TextField select size="small" label={t('search.sort')} value={form.sort} onChange={(e) => apply(null, { sort: e.target.value })}>
              {SORTS.map(([v, k]) => (
                <MenuItem key={v} value={v}>
                  {t(k)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 1.2 }}>
            <Button type="submit" variant="contained" fullWidth startIcon={<SearchIcon />} sx={{ height: 40 }}>
              {t('common.search')}
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.remoteOnly}
                  onChange={(e) => apply(null, { remoteOnly: e.target.checked })}
                  color="secondary"
                />
              }
              label={<Typography variant="body2">{t('search.remoteOnly')}</Typography>}
            />
          </Grid>
        </Grid>
      </Card>

      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <EmptyState title={t('search.loadFailed')} text={state.error} action={t('common.retry')} onAction={() => router.refresh()} />
      ) : state.items.length === 0 ? (
        <EmptyState title={t('search.emptyTitle')} text={t('search.emptyText')} action={t('search.emptyAction')} href="/waitlist" />
      ) : (
        <>
          <Grid container spacing={2}>
            {state.items.map((p) => {
              const showHeading = state.cityFirst && p.tier && p.tier !== lastTier;
              if (showHeading) lastTier = p.tier;
              return (
                <Box key={p._id} sx={{ display: 'contents' }}>
                  {showHeading && (
                    <Grid size={12}>
                      <TierHeading tier={p.tier} city={form.city || sp.get('city')} region={state.region || regionOf(sp.get('city'))} t={t} />
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <FreelancerCard p={p} />
                  </Grid>
                </Box>
              );
            })}
          </Grid>
          {state.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={state.pages}
                page={page}
                onChange={(_, v) => {
                  const p = new URLSearchParams(sp.toString());
                  p.set('page', v);
                  router.push(`/freelancers?${p.toString()}`);
                }}
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
