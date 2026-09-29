'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import { toast } from 'react-toastify';
import api, { errMsg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket, useSocketEvent } from '@/context/SocketContext';
import { useI18n } from '@/i18n/I18nProvider';
import { EmptyState, Loading, PolicyNote, UserAvatar } from '@/components/common';
import MessageBubble from './MessageBubble';
import { HireDialog, MeetingDialog, OfferDialog } from './ChatDialogs';
import { MAX_UPLOAD_MB } from '@/lib/constants';
import { rateLabel } from '@/lib/format';
import { brand } from '@/lib/theme';

export default function ChatWindow({ id }) {
  const { user } = useAuth();
  const { socket, refreshUnread, onlineUsers } = useSocket();
  const { t } = useI18n();
  const router = useRouter();
  const [conv, setConv] = useState(null);
  const [fp, setFp] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [dialog, setDialog] = useState(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const stopTypingTimer = useRef(null);

  const isClient = user?.role === 'client';
  const other = conv ? (String(conv.client._id) === String(user?._id) ? conv.freelancer : conv.client) : null;

  const scrollBottom = (smooth = true) =>
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });

  const markRead = useCallback(() => {
    api
      .post(`/conversations/${id}/read`)
      .then(() => refreshUnread())
      .catch(() => {});
  }, [id, refreshUnread]);

  useEffect(() => {
    let alive = true;
    setConv(null);
    setMessages([]);
    setError('');
    Promise.all([api.get(`/conversations/${id}`), api.get(`/conversations/${id}/messages`, { params: { limit: 40 } })])
      .then(([c, m]) => {
        if (!alive) return;
        setConv(c.data.conversation);
        setFp(c.data.freelancerProfile);
        setMessages(m.data.items);
        setHasMore(m.data.hasMore);
        scrollBottom(false);
        markRead();
      })
      .catch((e) => alive && setError(errMsg(e, t)));
    return () => {
      alive = false;
    };
  }, [id, markRead, t]);

  // Join the conversation room (typing indicator)
  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit('conversation:join', id);
    join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('conversation:leave', id);
    };
  }, [socket, id]);

  useSocketEvent('message:new', ({ conversationId, message }) => {
    if (conversationId !== String(id)) return;
    setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
    scrollBottom();
    if (String(message.sender) !== String(user?._id)) markRead();
  });

  useSocketEvent('message:update', ({ conversationId, message }) => {
    if (conversationId !== String(id)) return;
    setMessages((prev) => prev.map((m) => (m._id === message._id ? message : m)));
  });

  useSocketEvent('conversation:read', ({ conversationId, by }) => {
    if (conversationId !== String(id)) return;
    // Only mark ticks when the *other* side read; our own read clears the badge.
    if (String(by) === String(user?._id)) return;
    setMessages((prev) =>
      prev.map((m) => (String(m.sender) === String(user?._id) && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)),
    );
  });

  useSocketEvent('typing', ({ conversationId, userId, typing: isTyping }) => {
    if (conversationId !== String(id) || userId === String(user?._id)) return;
    setTyping(isTyping);
    clearTimeout(typingTimer.current);
    if (isTyping) typingTimer.current = setTimeout(() => setTyping(false), 4000);
  });

  const upsert = (msg) =>
    setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev.map((m) => (m._id === msg._id ? msg : m)) : [...prev, msg]));

  const loadOlder = async () => {
    if (!messages.length) return;
    try {
      const { data } = await api.get(`/conversations/${id}/messages`, {
        params: { before: messages[0].createdAt, limit: 40 },
      });
      setMessages((prev) => [...data.items, ...prev]);
      setHasMore(data.hasMore);
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  };

  /** Report M8: send typing:false too, so the indicator clears promptly. */
  const stopTyping = useCallback(() => {
    clearTimeout(stopTypingTimer.current);
    lastTypingSent.current = 0;
    socket?.emit('typing', { conversationId: id, typing: false });
  }, [socket, id]);

  const onTextChange = (e) => {
    setText(e.target.value);
    if (socket && Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      socket.emit('typing', { conversationId: id, typing: true });
    }
    clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(stopTyping, 3000);
  };

  useEffect(() => () => clearTimeout(stopTypingTimer.current), []);

  const send = async (e) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/conversations/${id}/messages`, { text: value });
      setText('');
      stopTyping();
      upsert(data.message);
      scrollBottom();
      if (data.warning) toast.warn(data.warning);
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  const sendFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return toast.warn(t('chat.fileTooBig', { mb: MAX_UPLOAD_MB }));
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    const tid = toast.loading(t('chat.fileUploading'));
    try {
      const { data } = await api.post(`/conversations/${id}/files`, fd);
      upsert(data.message);
      scrollBottom();
      toast.update(tid, { render: t('chat.fileSent'), type: 'success', isLoading: false, autoClose: 2000 });
    } catch (err) {
      toast.update(tid, { render: errMsg(err, t), type: 'error', isLoading: false, autoClose: 4000 });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onOffer = async (m, action) => {
    if (action === 'counter') return setDialog({ type: 'offer', data: m.offer });
    setBusy(true);
    try {
      const { data } = await api.post(`/messages/${m._id}/offer`, { action });
      upsert(data.message);
      toast.success(t({ accept: 'offer.accepted', decline: 'offer.declined', withdraw: 'offer.withdrawn' }[action]));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  const sendOffer = async (payload) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/conversations/${id}/offers`, payload);
      upsert(data.message);
      setDialog(null);
      scrollBottom();
      toast.success(t('offer.sent'));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  const onMeeting = async (m, action) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/messages/${m._id}/meeting`, { action });
      upsert(data.message);
      toast.success(t({ confirm: 'meeting.confirmed', decline: 'meeting.declined', cancel: 'meeting.cancelled' }[action]));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  const sendMeeting = async (payload) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/conversations/${id}/meetings`, payload);
      upsert(data.message);
      setDialog(null);
      scrollBottom();
      toast.success(t('meeting.sent'));
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Report C4: hiring creates a proposal the freelancer must accept — no
   * payment happens here any more.
   */
  const hire = async (payload) => {
    setBusy(true);
    try {
      const { data } = await api.post('/orders', { conversationId: id, ...payload });
      const order = data.order;
      setDialog(null);
      toast.success(t('hire.created', { no: order.orderNo }));
      toast.info(t('hire.waitingAccept'));
      router.push(`/orders/${order._id}`);
    } catch (err) {
      toast.error(errMsg(err, t));
    } finally {
      setBusy(false);
    }
  };

  const latestAccepted = [...messages].reverse().find((m) => m.type === 'offer' && m.offer?.status === 'accepted');
  const lastOffer = [...messages].reverse().find((m) => m.type === 'offer');

  if (error) return <EmptyState title={t('chat.chatNotOpen')} text={error} action={t('chat.allChats')} href="/inbox" />;
  if (!conv) return <Loading />;

  const presence = other?._id ? onlineUsers[String(other._id)] : undefined;
  const subtitle = typing
    ? t('chat.typing')
    : isClient && fp
      ? `${fp.title || ''} · ${rateLabel(fp.rate, t)}`
      : presence !== undefined
        ? presence
          ? t('chat.online')
          : t('chat.offline')
        : other?.companyName || (other?.role === 'client' ? t('chat.client') : '');

  const actionButtons = (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<LocalOfferOutlinedIcon />}
        onClick={() => setDialog({ type: 'offer', data: lastOffer?.offer })}
      >
        {t('chat.offer')}
      </Button>
      <Button size="small" variant="outlined" startIcon={<VideocamOutlinedIcon />} onClick={() => setDialog({ type: 'meeting' })}>
        {t('chat.meeting')}
      </Button>
      {isClient && (
        <Button
          size="small"
          variant="contained"
          startIcon={<HandshakeOutlinedIcon />}
          onClick={() => setDialog({ type: 'hire', data: latestAccepted })}
        >
          {t('chat.hire')}
        </Button>
      )}
    </>
  );

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', px: 2, py: 1.25, borderBottom: `1px solid ${brand.line}` }}
      >
        <IconButton component={Link} href="/inbox" sx={{ display: { md: 'none' } }} aria-label={t('common.back')}>
          <ArrowBackIcon />
        </IconButton>
        <UserAvatar user={other} size={40} showPresence />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {other?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {subtitle}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
          {actionButtons}
        </Stack>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: 2, py: 1, display: { xs: 'flex', sm: 'none' }, borderBottom: `1px solid ${brand.line}` }}
      >
        {actionButtons}
      </Stack>

      <Stack ref={listRef} spacing={1} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#FCFBFE', minHeight: 0 }}>
        <PolicyNote sx={{ alignSelf: 'center', maxWidth: 560 }} />
        {hasMore && (
          <Button size="small" onClick={loadOlder} sx={{ alignSelf: 'center' }}>
            {t('chat.loadOlder')}
          </Button>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m._id}
            m={m}
            mine={String(m.sender) === String(user?._id)}
            isClient={isClient}
            busy={busy}
            onOffer={onOffer}
            onMeeting={onMeeting}
            onHire={(msg) => setDialog({ type: 'hire', data: msg })}
          />
        ))}
      </Stack>

      <Stack
        component="form"
        onSubmit={send}
        direction="row"
        spacing={1}
        sx={{ alignItems: 'flex-end', p: 1.5, borderTop: `1px solid ${brand.line}` }}
      >
        <input ref={fileRef} type="file" hidden onChange={(e) => sendFile(e.target.files?.[0])} />
        <Tooltip title={t('chat.sendFile')}>
          <span>
            <IconButton onClick={() => fileRef.current?.click()} disabled={busy} aria-label={t('chat.sendFile')}>
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          size="small"
          placeholder={t('chat.messagePlaceholder')}
          value={text}
          onChange={onTextChange}
          onBlur={stopTyping}
          multiline
          maxRows={5}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <IconButton
          type="submit"
          disabled={!text.trim() || busy}
          sx={{
            bgcolor: brand.ink,
            color: '#fff',
            '&:hover': { bgcolor: brand.deep },
            '&.Mui-disabled': { bgcolor: brand.line },
          }}
          aria-label={t('chat.send')}
        >
          <SendRoundedIcon />
        </IconButton>
      </Stack>

      <OfferDialog
        open={dialog?.type === 'offer'}
        prev={dialog?.data}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={sendOffer}
      />
      <MeetingDialog open={dialog?.type === 'meeting'} busy={busy} onClose={() => setDialog(null)} onSubmit={sendMeeting} />
      {isClient && (
        <HireDialog
          open={dialog?.type === 'hire'}
          offer={dialog?.type === 'hire' ? dialog.data : null}
          freelancerName={other?.name}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={hire}
        />
      )}
    </Stack>
  );
}
