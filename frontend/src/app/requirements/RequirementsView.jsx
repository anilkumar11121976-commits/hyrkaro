'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { toast } from '@/lib/toast';
import api, { errMsg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { EmptyState, Loading, PageTitle } from '@/components/common';
import { CATEGORIES, CITIES, catName, cityName } from '@/lib/constants';
import { inr, timeAgo } from '@/lib/format';
import { brand } from '@/lib/theme';

export const REQ_STATUS_KEY = {
  open: 'requirement.statusOpen',
  closed: 'requirement.statusClosed',
  hired: 'requirement.statusHired',
  expired: 'requirement.statusExpired',
};
const REQ_STATUS_COLOR = { open: 'success', closed: 'default', hired: 'secondary', expired: 'default' };

function PostDialog({ open, onClose, onPosted }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [f, setF] = useState({
    title: '',
    description: '',
    category: '',
    city: '',
    budgetMin: '',
    budgetMax: '',
    remoteOk: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF({
        title: '',
        description: '',
        category: '',
        city: user?.city || '',
        budgetMin: '',
        budgetMax: '',
        remoteOk: true,
      });
    }
  }, [open, user?.city]);

  const valid = f.title.trim().length >= 5 && f.description.trim().length >= 20 && f.category;

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/requirements', {
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category,
        city: f.city,
        remoteOk: f.remoteOk,
        budgetMin: Number(f.budgetMin) || 0,
        budgetMax: Number(f.budgetMax) || 0,
      });
      toast.success(t('requirement.posted'));
      onPosted?.(data.requirement);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('requirement.postTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('requirement.workTitle')}
            placeholder={t('requirement.workTitlePlaceholder')}
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            autoFocus
          />
          <TextField
            label={t('requirement.description')}
            placeholder={t('requirement.descriptionPlaceholder')}
            multiline
            minRows={4}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label={t('common.category')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={t('common.city')} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {CITIES.map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label={t('requirement.budgetMin')}
              type="number"
              value={f.budgetMin}
              onChange={(e) => setF({ ...f, budgetMin: e.target.value })}
            />
            <TextField
              label={t('requirement.budgetMax')}
              type="number"
              value={f.budgetMax}
              onChange={(e) => setF({ ...f, budgetMax: e.target.value })}
            />
          </Stack>
          <FormControlLabel
            control={<Switch checked={f.remoteOk} onChange={(e) => setF({ ...f, remoteOk: e.target.checked })} color="secondary" />}
            label={t('requirement.remoteOk')}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={!valid || busy} onClick={submit}>
          {busy ? t('common.sending') : t('requirement.post')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RequirementCard({ r }) {
  const { t } = useI18n();
  const budget =
    r.budgetMin || r.budgetMax
      ? `${inr(r.budgetMin || 0)}${r.budgetMax ? ` – ${inr(r.budgetMax)}` : '+'}`
      : null;
  return (
    <Card sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { borderColor: brand.purple } }}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography component={Link} href={`/requirements/${r._id}`} sx={{ fontWeight: 700, fontSize: 17, color: brand.ink }}>
          {r.title}
        </Typography>
        <Chip size="small" label={t(REQ_STATUS_KEY[r.status] || REQ_STATUS_KEY.open)} color={REQ_STATUS_COLOR[r.status]} />
      </Stack>
      <Typography variant="body2" color="text.secondary" className="clamp-2" sx={{ mt: 1 }}>
        {r.description}
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
        <Chip size="small" variant="outlined" label={catName(r.category)} />
        {r.city && <Chip size="small" variant="outlined" label={cityName(r.city)} />}
        {budget && <Chip size="small" sx={{ bgcolor: brand.soft, color: brand.deep }} label={budget} />}
      </Stack>
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {timeAgo(r.createdAt)} · {t('requirement.interestCount', { count: r.interestCount || 0 })}
        </Typography>
        <Button size="small" component={Link} href={`/requirements/${r._id}`} variant={r.alreadySent ? 'text' : 'outlined'}>
          {r.alreadySent ? t('requirement.alreadySent') : t('common.view')}
        </Button>
      </Stack>
    </Card>
  );
}

export default function RequirementsView() {
  const { t } = useI18n();
  const { user, profile, ready } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState(sp.get('mine') ? 'mine' : 'board');
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [postOpen, setPostOpen] = useState(false);
  const [filters, setFilters] = useState({ category: sp.get('category') || '', city: sp.get('city') || '' });

  const isClient = user?.role === 'client';
  const isFreelancer = user?.role === 'freelancer';

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const params = tab === 'mine' ? { mine: true, limit: 50 } : { limit: 30, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get('/requirements', { params });
      setState({ loading: false, items: data.items, error: '' });
    } catch (e) {
      setState({ loading: false, items: [], error: errMsg(e, t) });
    }
  }, [tab, filters, t]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const openPost = () => {
    if (!user) return router.push('/login?next=/requirements');
    if (!isClient) return toast.info(t('requirement.subtitle'));
    setPostOpen(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <PageTitle
        title={t('requirement.title')}
        subtitle={t('requirement.subtitle')}
        action={
          isClient || !user ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openPost}>
              {t('requirement.post')}
            </Button>
          ) : null
        }
      />

      {isFreelancer && profile?.verification?.status !== 'verified' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('requirement.onlyVerified')}
        </Alert>
      )}

      {isClient && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} textColor="secondary" indicatorColor="secondary">
          <Tab value="board" label={t('requirement.board')} />
          <Tab value="mine" label={t('requirement.myRequirements')} />
        </Tabs>
      )}

      {tab === 'board' && (
        <Card sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                select
                size="small"
                label={t('common.category')}
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <MenuItem value="">{t('search.allCategories')}</MenuItem>
                {CATEGORIES.map((c) => (
                  <MenuItem key={c.slug} value={c.slug}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                select
                size="small"
                label={t('common.city')}
                value={filters.city}
                onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              >
                <MenuItem value="">{t('search.allCities')}</MenuItem>
                {CITIES.map((c) => (
                  <MenuItem key={c.slug} value={c.slug}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Card>
      )}

      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <EmptyState title={t('search.loadFailed')} text={state.error} action={t('common.retry')} onAction={load} />
      ) : state.items.length === 0 ? (
        <EmptyState
          title={tab === 'mine' ? t('requirement.noRequirements') : t('requirement.none')}
          text={tab === 'mine' ? t('requirement.noRequirementsSub') : t('requirement.noneSub')}
          action={tab === 'mine' ? t('requirement.post') : t('nav.findFreelancers')}
          onAction={tab === 'mine' ? openPost : undefined}
          href={tab === 'mine' ? undefined : '/freelancers'}
        />
      ) : (
        <Grid container spacing={2}>
          {state.items.map((r) => (
            <Grid key={r._id} size={{ xs: 12, sm: 6, md: 4 }}>
              <RequirementCard r={r} />
            </Grid>
          ))}
        </Grid>
      )}

      <PostDialog open={postOpen} onClose={() => setPostOpen(false)} onPosted={load} />
    </Container>
  );
}
