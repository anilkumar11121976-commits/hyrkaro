'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Card, Container, Stack, Typography } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import api, { errMsg } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';
import { useSocketEvent } from '@/context/SocketContext';
import { EmptyState, Loading, PageTitle, RequireAuth } from '@/components/common';
import { timeAgo } from '@/lib/format';
import { brand } from '@/lib/theme';

function Inner() {
  const { t } = useI18n();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 50 } });
      setItems(data.items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('notification:new', load);

  const markAll = async () => {
    setBusy(true);
    try {
      await api.post('/notifications/read', {});
      await load();
    } catch (e) {
      console.warn(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (!items) return <Loading />;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageTitle
        title={t('notif.title')}
        action={
          items.some((n) => !n.readAt) ? (
            <Button startIcon={<DoneAllIcon />} onClick={markAll} disabled={busy}>
              {t('notif.markAllRead')}
            </Button>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState title={t('notif.empty')} />
      ) : (
        <Stack spacing={1.25}>
          {items.map((n) => {
            const body = (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: n.readAt ? 'transparent' : brand.purple,
                    mt: '7px',
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: n.readAt ? 500 : 700 }}>{n.title}</Typography>
                  {n.body && (
                    <Typography variant="body2" color="text.secondary">
                      {n.body}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {timeAgo(n.createdAt)}
                  </Typography>
                </Box>
              </Stack>
            );
            return (
              <Card
                key={n._id}
                sx={{ p: 2, bgcolor: n.readAt ? undefined : '#FBFAFF', '&:hover': { borderColor: brand.purple } }}
                {...(n.link ? { component: Link, href: n.link } : {})}
              >
                {body}
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}

export default function NotificationsView() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
