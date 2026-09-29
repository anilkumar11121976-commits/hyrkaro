'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, Container, Grid, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useI18n } from '@/i18n/I18nProvider';
import { PageTitle, PolicyNote } from '@/components/common';
import { CATEGORIES, localPath } from '@/lib/constants';
import { inr } from '@/lib/format';
import { brand } from '@/lib/theme';

export default function ClientDashboard() {
  const { user } = useAuth();
  const { unread } = useSocket();
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [myReqs, setMyReqs] = useState([]);

  useEffect(() => {
    api
      .get('/orders', { params: { limit: 50 } })
      .then(({ data }) => setOrders(data.items))
      .catch(() => {});
    api
      .get('/requirements', { params: { mine: true, limit: 50 } })
      .then(({ data }) => setMyReqs(data.items))
      .catch(() => {});
  }, []);

  const active = orders.filter((o) => o.status === 'active').length;
  const needsAction = orders.filter(
    (o) => o.status === 'awaiting_payment' || o.milestones.some((m) => m.status === 'submitted'),
  ).length;
  const spent = orders.reduce(
    (s, o) => s + o.milestones.filter((m) => !['pending', 'refunded'].includes(m.status)).reduce((a, m) => a + m.amount, 0),
    0,
  );
  const openReqs = myReqs.filter((r) => r.status === 'open').length;
  const city = user.city || 'noida';

  const stats = [
    [t('dashboard.newChats'), unread, '/inbox'],
    [t('dashboard.activeWork'), active, '/orders'],
    [t('dashboard.needsAction'), needsAction, '/orders'],
    [t('dashboard.totalPaid'), inr(spent), '/orders'],
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <PageTitle
        title={t('dashboard.greeting', { name: user.name.split(' ')[0] })}
        subtitle={t('dashboard.clientSub')}
        action={
          <Stack direction="row" spacing={1}>
            <Button component={Link} href="/requirements" variant="outlined" startIcon={<AddIcon />}>
              {t('requirement.post')}
            </Button>
            <Button component={Link} href="/freelancers" variant="contained">
              {t('dashboard.findFreelancer')}
            </Button>
          </Stack>
        }
      />
      <Grid container spacing={2}>
        {stats.map(([l, v, href]) => (
          <Grid key={l} size={{ xs: 6, md: 3 }}>
            <Card component={Link} href={href} sx={{ p: 2, display: 'block', height: '100%', '&:hover': { borderColor: brand.purple } }}>
              <Typography variant="body2" color="text.secondary">
                {l}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.5 }}>
                {v}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {openReqs > 0 && (
        <Card
          component={Link}
          href="/requirements?mine=1"
          sx={{ p: 2.5, mt: 2, display: 'block', '&:hover': { borderColor: brand.purple } }}
        >
          <Typography sx={{ fontWeight: 700 }}>{t('requirement.myRequirements')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {openReqs} · {myReqs.reduce((s, r) => s + (r.interestCount || 0), 0)}{' '}
            {t('requirement.interestCount', { count: '' }).trim()}
          </Typography>
        </Card>
      )}

      <Typography variant="h6" sx={{ mt: 4, mb: 1.5 }}>
        {t('dashboard.pickCategory')}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <Button key={c.slug} component={Link} href={localPath(c.slug, city)} variant="outlined" sx={{ borderColor: brand.line }}>
            {c.emoji} {c.name}
          </Button>
        ))}
      </Stack>

      <Card sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6">{t('dashboard.howToHire')}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t('dashboard.howToHireSteps')}
        </Typography>
        <PolicyNote sx={{ mt: 2 }} />
      </Card>
    </Container>
  );
}
