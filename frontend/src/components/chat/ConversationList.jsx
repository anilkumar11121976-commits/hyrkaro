'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Box, List, ListItemAvatar, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import api from '@/lib/api';
import { useSocketEvent } from '@/context/SocketContext';
import { EmptyState, Loading, UserAvatar } from '@/components/common';
import { useI18n } from '@/i18n/I18nProvider';
import { timeAgo } from '@/lib/format';
import { brand } from '@/lib/theme';

export default function ConversationList({ activeId }) {
  const { t } = useI18n();
  const [items, setItems] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations');
      setItems(data.items);
    } catch {
      setItems((s) => s || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, activeId]);

  useSocketEvent('message:new', load);
  useSocketEvent('conversation:read', load);

  if (!items) return <Loading minHeight={200} />;
  if (!items.length)
    return (
      <EmptyState
        title={t('chat.noChats')}
        text={t('chat.noChatsSub')}
        action={t('chat.seeFreelancers')}
        href="/freelancers"
      />
    );

  return (
    <List disablePadding>
      {items.map((c) => {
        const active = String(c._id) === String(activeId);
        return (
          <ListItemButton
            key={c._id}
            component={Link}
            href={`/inbox/${c._id}`}
            selected={active}
            sx={{ py: 1.5, borderBottom: `1px solid ${brand.line}`, '&.Mui-selected': { bgcolor: brand.soft } }}
          >
            <ListItemAvatar>
              <Badge color="secondary" badgeContent={c.unread} max={99}>
                <UserAvatar user={c.other} size={44} showPresence />
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: c.unread ? 700 : 600 }} noWrap>
                    {c.other?.companyName && c.other.role === 'client' ? `${c.other.name} · ${c.other.companyName}` : c.other?.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {timeAgo(c.lastMessage?.at || c.updatedAt)}
                  </Typography>
                </Stack>
              }
              secondary={
                <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.unread ? 600 : 400 }}>
                  {c.lastMessage?.text || t('chat.startChat')}
                </Box>
              }
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
