'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  Container,
  Dialog,
  Divider,
  Grid,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlineOutlined';
import TranslateIcon from '@mui/icons-material/Translate';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { toast } from '@/lib/toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { EmptyState, Loading, PolicyNote, UserAvatar, VerifiedBadge } from '@/components/common';
import useStartChat from '@/components/useStartChat';
import { catName, cityName, localPath } from '@/lib/constants';
import { date, rateLabel } from '@/lib/format';
import { brand } from '@/lib/theme';

export default function ProfileView({ id, initial }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [preview, setPreview] = useState(null);
  const { user } = useAuth();
  const { t } = useI18n();
  const { start, busy } = useStartChat();
  const router = useRouter();
  const sp = useSearchParams();
  const autoStarted = useRef(false);

  // Fetch profiles that were not available to the server-rendered request.
  useEffect(() => {
    if (initial) return;
    api
      .get(`/freelancers/${id}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id, initial]);

  // After a login redirect (?chat=1) open the chat automatically.
  useEffect(() => {
    if (sp.get('chat') === '1' && user && data?.profile && !autoStarted.current) {
      autoStarted.current = true;
      start(data.profile._id);
    }
  }, [sp, user, data, start]);

  /**
   * PDF §4: the Hire button exists on the profile but only opens once a chat
   * has happened — otherwise it nudges you into the chat first.
   */
  const onHire = useCallback(async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/freelancers/${id}?chat=1`)}`);
      return;
    }
    try {
      const { data: convs } = await api.get('/conversations');
      const existing = convs.items?.find((c) => String(c.other?._id) === String(data?.profile?.user?._id));
      if (existing) {
        router.push(`/inbox/${existing._id}`);
      } else {
        toast.info(t('profile.hireNeedsChat'));
        start(data.profile._id);
      }
    } catch {
      start(data.profile._id);
    }
  }, [user, router, id, data, start, t]);

  if (loading) return <Loading />;
  if (!data?.profile) {
    return (
      <EmptyState
        title={t('profile.notFound')}
        text={t('profile.notFoundText')}
        action={t('profile.seeMore')}
        href="/freelancers"
      />
    );
  }

  const { profile: p, reviews = [] } = data;
  const u = p.user || {};
  const isOwner = user && String(user._id) === String(u._id);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 2, fontSize: 14 }}>
        <Link href="/">HyrKro</Link>
        {p.category && p.city && (
          <Link href={localPath(p.category, p.city)}>
            {catName(p.category)} in {cityName(p.city)}
          </Link>
        )}
        <Typography color="text.primary" sx={{ fontSize: 14 }}>
          {u.name}
        </Typography>
      </Breadcrumbs>

      {isOwner && !p.isVisible && (
        <Card sx={{ p: 2, mb: 2, bgcolor: '#FFF8E6', borderColor: '#F5D48A' }}>
          <Typography>{t('profile.notPublic', { status: p.verification?.status })}</Typography>
        </Card>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: { sm: 'center' } }}>
              <UserAvatar user={u} size={96} showPresence />
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="h4" component="h1">
                    {u.name}
                  </Typography>
                  {p.verification?.status === 'verified' && <VerifiedBadge />}
                  {p.isPro && <Chip size="small" label="Pro" sx={{ bgcolor: brand.ink, color: '#fff' }} />}
                </Stack>
                <Typography sx={{ fontSize: 18, mt: 0.5 }}>{p.title || catName(p.category)}</Typography>
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mt: 1, color: 'text.secondary' }} useFlexGap>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <PlaceOutlinedIcon fontSize="small" />
                    <span>{[p.area, cityName(p.city)].filter(Boolean).join(', ')}</span>
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <WorkOutlineIcon fontSize="small" />
                    <span>{t('profile.yearsExp', { years: p.experienceYears || 0 })}</span>
                  </Stack>
                  {p.languages?.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <TranslateIcon fontSize="small" />
                      <span>{p.languages.join(', ')}</span>
                    </Stack>
                  )}
                </Stack>
              </Box>
            </Stack>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6">{t('profile.about')}</Typography>
            <Typography sx={{ whiteSpace: 'pre-line', mt: 1 }}>{p.bio || t('profile.noBio')}</Typography>

            {p.skills?.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 3 }}>
                  {t('profile.skills')}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
                  {p.skills.map((s) => (
                    <Chip key={s} label={s} sx={{ bgcolor: brand.soft, color: brand.deep }} />
                  ))}
                </Stack>
              </>
            )}

            <Typography variant="h6" sx={{ mt: 3 }}>
              {t('profile.portfolio')}
            </Typography>
            {p.portfolio?.length ? (
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                {p.portfolio.map((it) => (
                  <Grid key={it._id} size={{ xs: 6, sm: 4 }}>
                    {it.resourceType === 'image' ? (
                      <Box
                        component="button"
                        onClick={() => setPreview(it)}
                        sx={{
                          p: 0,
                          border: `1px solid ${brand.line}`,
                          borderRadius: 2,
                          overflow: 'hidden',
                          width: '100%',
                          cursor: 'zoom-in',
                          bgcolor: '#fff',
                        }}
                      >
                        <Box
                          component="img"
                          src={it.url}
                          alt={it.title || 'Portfolio'}
                          loading="lazy"
                          sx={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                        />
                      </Box>
                    ) : (
                      <Card
                        component="a"
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center', aspectRatio: '4/3' }}
                      >
                        <InsertDriveFileOutlinedIcon />
                        <Typography variant="body2" noWrap>
                          {it.title}
                        </Typography>
                      </Card>
                    )}
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {t('profile.noPortfolio')}
              </Typography>
            )}
          </Card>

          <Card sx={{ p: { xs: 2.5, md: 3 }, mt: 3 }}>
            <Typography variant="h6">
              {t('profile.reviews')} {p.ratingCount > 0 && `(${p.ratingCount})`}
            </Typography>
            {reviews.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {t('profile.noReviews')}
              </Typography>
            ) : (
              <Stack divider={<Divider />} spacing={2} sx={{ mt: 2 }}>
                {reviews.map((r) => (
                  <Box key={r._id}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <UserAvatar user={r.client} size={32} />
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{r.client?.companyName || r.client?.name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Rating value={r.rating} readOnly size="small" />
                          <Typography variant="caption" color="text.secondary">
                            {date(r.createdAt)}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                    {r.comment && <Typography sx={{ mt: 1 }}>{r.comment}</Typography>}
                  </Box>
                ))}
              </Stack>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3, position: { md: 'sticky' }, top: { md: 88 } }}>
            <Typography color="text.secondary">{t('profile.chargesLabel')}</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {rateLabel(p.rate, t)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
              <Rating value={p.ratingAvg || 0} precision={0.1} readOnly size="small" />
              <Typography variant="body2" color="text.secondary">
                {p.ratingCount
                  ? `${Number(p.ratingAvg).toFixed(1)} · ${t('profile.ordersDone', { count: p.completedOrders || 0 })}`
                  : t('profile.newFreelancer')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('profile.respondsIn', { hours: p.responseTimeHrs || 2 })}
            </Typography>

            {!isOwner && p.verification?.status === 'verified' && (
              <Stack spacing={1} sx={{ mt: 2.5 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<ChatOutlinedIcon />}
                  onClick={() => start(p._id)}
                  disabled={busy}
                >
                  {busy ? t('profile.chatOpening') : t('profile.chatButton')}
                </Button>
                {/* PDF §4: hire is visible, but routes through chat first */}
                <Button fullWidth variant="outlined" startIcon={<HandshakeOutlinedIcon />} onClick={onHire} disabled={busy}>
                  {t('profile.hireButton')}
                </Button>
              </Stack>
            )}
            {!isOwner && p.verification?.status !== 'verified' && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
                {t('profile.unverifiedNotice')}
              </Typography>
            )}
            {isOwner && (
              <Button fullWidth component={Link} href="/dashboard" variant="outlined" size="large" sx={{ mt: 2.5 }}>
                {t('profile.editProfile')}
              </Button>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('profile.chatFirstNote')}
            </Typography>
            <PolicyNote sx={{ mt: 2 }} />
          </Card>
        </Grid>
      </Grid>

      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md">
        {preview && (
          <Box
            component="img"
            src={preview.url}
            alt={preview.title || ''}
            sx={{ maxWidth: '100%', maxHeight: '85vh', display: 'block' }}
          />
        )}
      </Dialog>
    </Container>
  );
}
