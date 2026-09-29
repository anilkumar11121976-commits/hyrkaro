'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import { toast } from 'react-toastify';
import api, { errMsg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { EmptyState, Loading, PolicyNote, UserAvatar } from '@/components/common';
import { catName, cityName } from '@/lib/constants';
import { date, inr, rateLabel, timeAgo } from '@/lib/format';
import { brand } from '@/lib/theme';
import { REQ_STATUS_KEY } from '@/app/requirements/RequirementsView';

function InterestDialog({ open, onClose, onSent, requirementId }) {
  const { t } = useI18n();
  const [f, setF] = useState({ message: '', quote: '', deliveryDays: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setF({ message: '', quote: '', deliveryDays: '' });
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { message: f.message.trim() };
      if (f.quote) payload.quote = Number(f.quote);
      if (f.deliveryDays) payload.deliveryDays = Number(f.deliveryDays);
      const { data } = await api.post(`/requirements/${requirementId}/interest`, payload);
      toast.success(t('requirement.interestSent'));
      if (data.warning) toast.warn(data.warning);
      onSent?.(data);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('requirement.interestTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info" icon={false}>
            {t('requirement.oncePerPost')}
          </Alert>
          <TextField
            label={t('requirement.interestMessage')}
            placeholder={t('requirement.interestMessagePlaceholder')}
            multiline
            minRows={4}
            value={f.message}
            onChange={(e) => setF({ ...f, message: e.target.value })}
            autoFocus
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label={t('requirement.yourQuote')}
              type="number"
              value={f.quote}
              onChange={(e) => setF({ ...f, quote: e.target.value })}
            />
            <TextField
              label={t('requirement.yourDelivery')}
              type="number"
              value={f.deliveryDays}
              onChange={(e) => setF({ ...f, deliveryDays: e.target.value })}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={busy} onClick={submit}>
          {busy ? t('common.sending') : t('requirement.sendInterest')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RequirementDetail({ id }) {
  const { t } = useI18n();
  const { user, profile, ready } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/requirements/${id}`);
      setData(d);
    } catch (e) {
      setError(errMsg(e, t));
    }
  }, [id, t]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const startChat = async (interestId) => {
    setBusy(true);
    try {
      const { data: d } = await api.post(`/requirements/${id}/interests/${interestId}/chat`);
      router.push(`/inbox/${d.conversationId}`);
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/requirements/${id}`, { status });
      toast.success(status === 'closed' ? t('requirement.closed') : t('common.saved'));
      await load();
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <EmptyState title={t('common.notFound')} text={error} action={t('requirement.title')} href="/requirements" />;
  if (!data) return <Loading />;

  const r = data.requirement;
  const isOwner = String(r.client?._id) === String(user?._id);
  const isFreelancer = user?.role === 'freelancer';
  const verified = profile?.verification?.status === 'verified';
  const budget =
    r.budgetMin || r.budgetMax ? `${inr(r.budgetMin || 0)}${r.budgetMax ? ` – ${inr(r.budgetMax)}` : '+'}` : null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button component={Link} href="/requirements" color="inherit" sx={{ mb: 1 }}>
        ← {t('requirement.title')}
      </Button>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="h5" component="h1">
                {r.title}
              </Typography>
              <Chip size="small" label={t(REQ_STATUS_KEY[r.status] || REQ_STATUS_KEY.open)} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('requirement.postedBy', { name: r.client?.companyName || r.client?.name || '' })} · {timeAgo(r.createdAt)}
            </Typography>
            <Typography sx={{ mt: 2, whiteSpace: 'pre-line' }}>{r.description}</Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
              <Chip size="small" variant="outlined" label={catName(r.category)} />
              {r.city && <Chip size="small" variant="outlined" label={cityName(r.city)} />}
              {budget && <Chip size="small" sx={{ bgcolor: brand.soft, color: brand.deep }} label={budget} />}
              {r.deadline && <Chip size="small" variant="outlined" label={date(r.deadline)} />}
            </Stack>
          </Card>

          {/* PDF §11: only the client who posted sees who responded */}
          {isOwner && (
            <Card sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6">
                {t('requirement.interestsReceived')} ({data.interests?.length || 0})
              </Typography>
              {!data.interests?.length ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {t('requirement.noInterests')}
                </Typography>
              ) : (
                <Stack divider={<Divider />} spacing={2} sx={{ mt: 2 }}>
                  {data.interests.map((i) => (
                    <Box key={i._id}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                        <UserAvatar user={i.freelancer} size={48} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            component={i.profile ? Link : 'span'}
                            href={i.profile ? `/freelancers/${i.profile._id}` : undefined}
                            sx={{ fontWeight: 700, color: brand.ink }}
                          >
                            {i.freelancer?.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {i.profile?.title || ''}
                            {i.profile?.rate ? ` · ${rateLabel(i.profile.rate)}` : ''}
                          </Typography>
                          {i.profile?.ratingCount > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                              <Rating value={i.profile.ratingAvg} precision={0.1} readOnly size="small" />
                              <Typography variant="caption" color="text.secondary">
                                ({i.profile.ratingCount})
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                        <Stack spacing={0.5} sx={{ alignItems: { sm: 'flex-end' } }}>
                          {i.quote ? <Typography sx={{ fontWeight: 700 }}>{inr(i.quote)}</Typography> : null}
                          {i.deliveryDays ? (
                            <Typography variant="caption" color="text.secondary">
                              {i.deliveryDays} {t('common.days')}
                            </Typography>
                          ) : null}
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<ChatOutlinedIcon />}
                            disabled={busy}
                            onClick={() => startChat(i._id)}
                          >
                            {t('requirement.chatWith')}
                          </Button>
                        </Stack>
                      </Stack>
                      {i.message && (
                        <Typography sx={{ mt: 1, whiteSpace: 'pre-line' }} color="text.secondary">
                          {i.message}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          )}
        </Box>

        <Box sx={{ width: { md: 320 }, flexShrink: 0 }}>
          <Card sx={{ p: 3 }}>
            {isOwner ? (
              <Stack spacing={1.5}>
                <Typography sx={{ fontWeight: 700 }}>{t('requirement.myRequirements')}</Typography>
                {r.status === 'open' ? (
                  <Button variant="outlined" color="inherit" disabled={busy} onClick={() => setStatus('closed')}>
                    {t('requirement.closeRequirement')}
                  </Button>
                ) : r.status === 'closed' ? (
                  <Button variant="outlined" disabled={busy} onClick={() => setStatus('open')}>
                    {t('requirement.reopenRequirement')}
                  </Button>
                ) : null}
              </Stack>
            ) : isFreelancer ? (
              <Stack spacing={1.5}>
                {data.mine ? (
                  <Alert severity="success" icon={false}>
                    {t('requirement.alreadySent')}
                  </Alert>
                ) : !verified ? (
                  <Alert severity="info" icon={false}>
                    {t('requirement.onlyVerified')}
                  </Alert>
                ) : r.status !== 'open' ? (
                  <Alert severity="info" icon={false}>
                    {t('requirement.closed')}
                  </Alert>
                ) : (
                  <Button variant="contained" size="large" onClick={() => setDialogOpen(true)}>
                    {t('requirement.sendInterest')}
                  </Button>
                )}
                <Typography variant="body2" color="text.secondary">
                  {t('requirement.oncePerPost')}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('requirement.subtitle')}
                </Typography>
                {!user && (
                  <Button component={Link} href={`/login?next=/requirements/${id}`} variant="contained">
                    {t('nav.login')}
                  </Button>
                )}
              </Stack>
            )}
            <PolicyNote sx={{ mt: 2 }} />
          </Card>
        </Box>
      </Stack>

      <InterestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSent={load} requirementId={id} />
    </Container>
  );
}
