'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, Chip, Container, Stack, Tab, Tabs, Typography } from '@mui/material';
import api, { errMsg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { useI18n } from '@/i18n/I18nProvider';
import { EmptyState, Loading, PageTitle, UserAvatar } from '@/components/common';
import { ORDER_STATUS } from '@/lib/constants';
import { date, inr } from '@/lib/format';

const TABS = [
  ['', 'order.tabAll'],
  ['awaiting_acceptance', 'order.tabAwaitingAccept'],
  ['awaiting_payment', 'order.tabAwaitingPayment'],
  ['active', 'order.tabActive'],
  ['completed', 'order.tabCompleted'],
  ['disputed', 'order.tabDisputed'],
];

export default function OrderList() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState('');
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    api
      .get('/orders', { params: tab ? { status: tab } : {} })
      .then(({ data }) => alive && setState({ loading: false, items: data.items, error: '' }))
      .catch((e) => alive && setState({ loading: false, items: [], error: errMsg(e, t) }));
    return () => {
      alive = false;
    };
  }, [tab, tick, t]);

  useSocketEvent('order:update', () => setTick((n) => n + 1));

  const isFreelancer = user?.role === 'freelancer';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageTitle title={t('order.title')} subtitle={isFreelancer ? t('order.subFreelancer') : t('order.subClient')} />
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        sx={{ mb: 2 }}
        textColor="secondary"
        indicatorColor="secondary"
      >
        {TABS.map(([v, k]) => (
          <Tab key={v} value={v} label={t(k)} />
        ))}
      </Tabs>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <EmptyState title={t('order.loadFailed')} text={state.error} />
      ) :!Array.isArray(state.items) || state.items.length === 0 ? (
        <EmptyState
          title={t('order.none')}
          text={isFreelancer ? t('order.noneFreelancer') : t('order.noneClient')}
          action={isFreelancer ? t('nav.dashboard') : t('chat.seeFreelancers')}
          href={isFreelancer ? '/dashboard' : '/freelancers'}
        />
      ) : (
        <Stack spacing={1.5}>
          {state.items.map((o) => {
            const other = isFreelancer ? o.client : o.freelancer;
            const st = ORDER_STATUS[o.status] || {};
            const done = o.milestones.filter((m) => m.status === 'released').length;
            return (
              <Card key={o._id}>
                <CardActionArea component={Link} href={`/orders/${o._id}`} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <UserAvatar user={other} size={44} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {o.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {other?.name} · {o.orderNo} · {date(o.createdAt)} ·{' '}
                        {t('order.milestonesDone', { done, total: o.milestones.length })}
                      </Typography>
                    </Box>
                    <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                      <Typography sx={{ fontWeight: 700 }}>{inr(o.amount)}</Typography>
                      <Chip size="small" label={st.key ? t(st.key) : o.status} color={st.color} />
                    </Stack>
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
