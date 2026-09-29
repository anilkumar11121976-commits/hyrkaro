'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  Grid,
  LinearProgress,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import { toast } from 'react-toastify';
import api, { errMsg } from '@/lib/api';
import { payMilestone } from '@/lib/razorpay';
import { useAuth } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { useI18n } from '@/i18n/I18nProvider';
import { EmptyState, Loading, PolicyNote, UserAvatar } from '@/components/common';
import { MAX_UPLOAD_MB, MS_STATUS, ORDER_STATUS } from '@/lib/constants';
import { date, dateTime, inr } from '@/lib/format';
import { brand } from '@/lib/theme';

function SubmitDialog({ open, onClose, onSubmit, busy }) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  useEffect(() => {
    if (open) {
      setNote('');
      setFiles([]);
    }
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('order.submitTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info" icon={false}>
            {t('order.previewNote')}
          </Alert>
          <TextField
            label={t('order.submitNote')}
            multiline
            minRows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('order.submitNotePlaceholder')}
          />
          <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
            {t('order.attachFiles', { mb: MAX_UPLOAD_MB })}
            <input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
          </Button>
          {files.map((f) => (
            <Typography key={f.name} variant="body2">
              • {f.name}
            </Typography>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={busy || (!note.trim() && !files.length)} onClick={() => onSubmit(note, files)}>
          {busy ? t('common.sending') : t('order.submitWork')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NoteDialog({ open, onClose, onSubmit, busy, title, label, placeholder, minLen = 3, cta }) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          sx={{ mt: 1 }}
          label={label}
          multiline
          minRows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={busy || note.trim().length < minLen} onClick={() => onSubmit(note.trim())}>
          {cta || t('common.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DisputeDialog({ open, onClose, onSubmit, busy, milestones }) {
  const { t } = useI18n();
  const [f, setF] = useState({ reason: '', milestoneId: '' });
  useEffect(() => {
    if (open) setF({ reason: '', milestoneId: '' });
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('dispute.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning" icon={false}>
            {t('dispute.intro')}
          </Alert>
          <TextField
            select
            label={t('dispute.whichMilestone')}
            value={f.milestoneId}
            onChange={(e) => setF({ ...f, milestoneId: e.target.value })}
          >
            <MenuItem value="">—</MenuItem>
            {milestones.map((m, i) => (
              <MenuItem key={m._id} value={m._id}>
                {i + 1}. {m.title} · {inr(m.amount)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('dispute.reason')}
            placeholder={t('dispute.reasonPlaceholder')}
            multiline
            minRows={4}
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={busy || f.reason.trim().length < 10}
          onClick={() => onSubmit({ reason: f.reason.trim(), milestoneId: f.milestoneId || undefined })}
        >
          {t('dispute.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** PDF §9: watermarked preview until release, then the real files. */
function DeliveryFiles({ ms, released }) {
  const { t } = useI18n();
  const previews = ms.submission?.preview || [];
  const files = ms.submission?.files || [];
  const lockedCount = ms.submission?.fileCount ?? 0;

  if (released && files.length) {
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {t('order.originalFiles')}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {files.map((f) => (
            <Stack
              key={f.url}
              component="a"
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', color: 'secondary.main' }}
            >
              <InsertDriveFileOutlinedIcon fontSize="small" />
              <Typography variant="body2">{f.name}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    );
  }

  if (!previews.length && !lockedCount) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <LockOutlinedIcon sx={{ fontSize: 15, color: brand.purple }} />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {t('order.previewOnly')}
        </Typography>
      </Stack>
      <Grid container spacing={1} sx={{ mt: 0.5 }}>
        {previews.map((p, i) => (
          <Grid key={`${p.name}-${i}`} size={{ xs: 6, sm: 4 }}>
            {p.url ? (
              <Box
                component="img"
                src={p.url}
                alt={p.name}
                sx={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 1, display: 'block' }}
              />
            ) : (
              <Card sx={{ p: 1, display: 'flex', gap: 0.5, alignItems: 'center', aspectRatio: '4/3' }}>
                <InsertDriveFileOutlinedIcon fontSize="small" />
                <Typography variant="caption" noWrap>
                  {p.name}
                </Typography>
              </Card>
            )}
          </Grid>
        ))}
      </Grid>
      {lockedCount > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {t('order.filesLocked', { count: lockedCount })}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {t('order.previewNote')}
      </Typography>
    </Box>
  );
}

export default function OrderDetail({ id }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [review, setReview] = useState({ rating: 5, comment: '' });

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/orders/${id}`);
      setData(d);
    } catch (e) {
      setError(errMsg(e, t));
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('order:update', ({ orderId }) => {
    if (orderId === String(id)) load();
  });

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      setDlg(null);
      await load();
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <EmptyState title={t('order.notOpened')} text={error} action={t('order.allOrders')} href="/orders" />;
  if (!data) return <Loading />;

  const o = data.order;
  const isClient = String(o.client._id) === String(user?._id);
  const isFreelancer = String(o.freelancer._id) === String(user?._id);
  const other = isClient ? o.freelancer : o.client;
  const released = o.milestones.filter((m) => m.status === 'released').length;
  const st = ORDER_STATUS[o.status] || {};
  const escrowHeld = o.milestones
    .filter((m) => ['funded', 'submitted', 'changes_requested'].includes(m.status))
    .reduce((s, m) => s + m.amount, 0);
  const canDispute = o.status !== 'disputed' && escrowHeld > 0;

  const pay = (ms) =>
    run(async () => {
      const r = await payMilestone(o._id, ms._id);
      if (!r.ok) throw new Error(t('order.paymentCancelled'));
    }, t('order.paid'));

  const submit = (note, files) =>
    run(async () => {
      const fd = new FormData();
      fd.append('note', note);
      files.forEach((f) => fd.append('files', f));
      await api.post(`/orders/${o._id}/milestones/${dlg.ms._id}/submit`, fd);
    }, t('order.submitted'));

  const approve = (ms) => {
    if (!window.confirm(t('order.approveConfirm', { title: ms.title, amount: inr(ms.amount) }))) return;
    run(() => api.post(`/orders/${o._id}/milestones/${ms._id}/approve`), t('order.approved', { days: 3 }));
  };

  const changes = (note) =>
    run(() => api.post(`/orders/${o._id}/milestones/${dlg.ms._id}/request-changes`, { note }), t('order.changesSent'));

  const cancel = () => {
    if (!window.confirm(t('order.cancelConfirm'))) return;
    run(() => api.post(`/orders/${o._id}/cancel`, { reason: '' }), t('order.cancelled'));
  };

  const acceptOrder = () => run(() => api.post(`/orders/${o._id}/accept`), t('order.accepted'));
  const declineOrder = (reason) => run(() => api.post(`/orders/${o._id}/decline`, { reason }), t('order.declined'));
  const openDispute = (payload) => run(() => api.post(`/orders/${o._id}/dispute`, payload), t('dispute.opened'));
  const withdrawDispute = () => run(() => api.post(`/orders/${o._id}/dispute/withdraw`), t('dispute.withdrawn'));
  const sendReview = () => run(() => api.post(`/orders/${o._id}/review`, review), t('order.reviewThanks'));

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button component={Link} href="/orders" color="inherit" sx={{ mb: 1 }}>
        {t('order.backToOrders')}
      </Button>

      {o.status === 'disputed' && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<GavelOutlinedIcon />}>
          {t('dispute.openBanner')}
          {o.dispute?.reason ? ` — ${o.dispute.reason}` : ''}
          {String(o.dispute?.raisedBy) === String(user?._id) && (
            <Button size="small" sx={{ ml: 1 }} disabled={busy} onClick={withdrawDispute}>
              {t('dispute.withdraw')}
            </Button>
          )}
        </Alert>
      )}
      {o.dispute?.resolution && o.status !== 'disputed' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('dispute.resolvedBanner', { note: o.dispute.resolution })}
        </Alert>
      )}
      {isFreelancer && o.status === 'awaiting_acceptance' && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" disabled={busy} onClick={acceptOrder}>
                {t('order.accept')}
              </Button>
              <Button size="small" color="inherit" disabled={busy} onClick={() => setDlg({ type: 'decline' })}>
                {t('order.decline')}
              </Button>
            </Stack>
          }
        >
          {t('order.acceptNote')}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {o.orderNo} · {date(o.createdAt)}
                </Typography>
                <Typography variant="h5" component="h1">
                  {o.title}
                </Typography>
              </Box>
              <Chip label={st.key ? t(st.key) : o.status} color={st.color} />
            </Stack>
            {o.description && <Typography sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>{o.description}</Typography>}

            <Box sx={{ mt: 3 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600 }}>{t('order.progress')}</Typography>
                <Typography color="text.secondary">
                  {t('order.milestonesDone', { done: released, total: o.milestones.length })}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(released / o.milestones.length) * 100}
                color="secondary"
                sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: brand.soft }}
              />
            </Box>

            <Stack divider={<Divider />} spacing={2} sx={{ mt: 3 }}>
              {o.milestones.map((ms, i) => {
                const s = MS_STATUS[ms.status] || {};
                const prevPending = o.milestones.slice(0, i).some((m) => m.status === 'pending');
                const open = !['cancelled', 'completed', 'refunded', 'disputed', 'awaiting_acceptance'].includes(o.status);
                return (
                  <Box key={ms._id}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {i + 1}. {ms.title}
                        </Typography>
                        <Typography color="text.secondary">{inr(ms.amount)}</Typography>
                      </Box>
                      <Box>
                        <Chip
                          size="small"
                          label={s.key ? t(s.key) : ms.status}
                          color={s.color}
                          variant={ms.status === 'pending' ? 'outlined' : 'filled'}
                        />
                      </Box>
                    </Stack>

                    {ms.status === 'changes_requested' && ms.changesNote && (
                      <Alert severity="warning" sx={{ mt: 1.5 }}>
                        {t('order.changesNote', { note: ms.changesNote })}
                      </Alert>
                    )}

                    {ms.submission && ['submitted', 'changes_requested', 'released'].includes(ms.status) && (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#F7F5FB', borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t('order.submission', { when: dateTime(ms.submittedAt) })}
                          {ms.submission.revision > 1 ? ` · ${t('order.revision', { n: ms.submission.revision })}` : ''}
                        </Typography>
                        {ms.submission.note && (
                          <Typography sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>{ms.submission.note}</Typography>
                        )}
                        <DeliveryFiles ms={ms} released={ms.status === 'released'} />
                      </Box>
                    )}

                    {isFreelancer && ms.payout?.status && ms.payout.status !== 'none' && (
                      <Typography variant="body2" sx={{ mt: 1, color: brand.deep }}>
                        {t('order.youGet', { amount: inr(ms.payout.amount), commission: inr(ms.payout.commission) })} ·{' '}
                        {ms.payout.status === 'paid'
                          ? t('order.payoutPaid', { date: date(ms.payout.paidAt) })
                          : ms.payout.status === 'on_hold'
                            ? t('order.payoutOnHold', { reason: ms.payout.holdReason || '' })
                            : t('order.payoutBy', { date: date(ms.payout.dueAt) })}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5 }} useFlexGap>
                      {isClient && open && ms.status === 'pending' && (
                        <Button variant="contained" disabled={busy || prevPending} onClick={() => pay(ms)}>
                          {t('order.payNow', { amount: inr(ms.amount) })}
                        </Button>
                      )}
                      {isClient && ms.status === 'pending' && prevPending && (
                        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                          {t('order.payFirst')}
                        </Typography>
                      )}
                      {isFreelancer && open && ['funded', 'changes_requested'].includes(ms.status) && (
                        <Button variant="contained" disabled={busy} onClick={() => setDlg({ type: 'submit', ms })}>
                          {t('order.submitWork')}
                        </Button>
                      )}
                      {isFreelancer && ms.status === 'pending' && o.status !== 'awaiting_acceptance' && (
                        <Typography variant="body2" color="text.secondary">
                          {t('order.waitPayment')}
                        </Typography>
                      )}
                      {isClient && open && ms.status === 'submitted' && (
                        <>
                          <Button variant="contained" color="secondary" disabled={busy} onClick={() => approve(ms)}>
                            {t('order.approve')}
                          </Button>
                          <Button variant="outlined" disabled={busy} onClick={() => setDlg({ type: 'changes', ms })}>
                            {t('order.needChanges')}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Card>

          {isClient && o.status === 'completed' && !o.reviewed && (
            <Card sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6">{t('order.reviewTitle', { name: o.freelancer.name })}</Typography>
              <Rating
                value={review.rating}
                onChange={(_, v) => setReview((r) => ({ ...r, rating: v || 1 }))}
                size="large"
                sx={{ mt: 1 }}
              />
              <TextField
                multiline
                minRows={3}
                sx={{ mt: 1.5 }}
                placeholder={t('order.reviewPlaceholder')}
                value={review.comment}
                onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))}
              />
              <Button variant="contained" sx={{ mt: 1.5 }} disabled={busy} onClick={sendReview}>
                {t('order.reviewSend')}
              </Button>
            </Card>
          )}
          {data.review && (
            <Card sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6">{t('order.review')}</Typography>
              <Rating value={data.review.rating} readOnly sx={{ mt: 1 }} />
              {data.review.comment && <Typography sx={{ mt: 1 }}>{data.review.comment}</Typography>}
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3 }}>
            <Typography color="text.secondary">{isClient ? t('order.freelancer') : t('order.client')}</Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1 }}>
              <UserAvatar user={other} size={44} showPresence />
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{other.name}</Typography>
                {other.companyName && (
                  <Typography variant="body2" color="text.secondary">
                    {other.companyName}
                  </Typography>
                )}
              </Box>
            </Stack>
            <Button
              component={Link}
              href={`/inbox/${o.conversation}`}
              fullWidth
              variant="outlined"
              startIcon={<ChatOutlinedIcon />}
              sx={{ mt: 2 }}
            >
              {t('order.openChat')}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={0.75}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">{t('common.total')}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{inr(o.amount)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">{t('common.clientFee')}</Typography>
                <Typography>₹0</Typography>
              </Stack>
              {isFreelancer && (
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('order.commission')}</Typography>
                  <Typography>{o.commissionPercent}%</Typography>
                </Stack>
              )}
              {o.deliveryDays && (
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">{t('order.delivery')}</Typography>
                  <Typography>
                    {o.deliveryDays} {t('common.days')}
                  </Typography>
                </Stack>
              )}
            </Stack>

            <Stack spacing={1} sx={{ mt: 2 }}>
              {isFreelancer && o.status === 'awaiting_acceptance' && (
                <>
                  <Button variant="contained" fullWidth disabled={busy} onClick={acceptOrder}>
                    {t('order.accept')}
                  </Button>
                  <Button color="inherit" fullWidth disabled={busy} onClick={() => setDlg({ type: 'decline' })}>
                    {t('order.decline')}
                  </Button>
                </>
              )}
              {['awaiting_acceptance', 'awaiting_payment'].includes(o.status) && escrowHeld === 0 && (
                <Button color="error" fullWidth disabled={busy} onClick={cancel}>
                  {t('order.cancelOrder')}
                </Button>
              )}
              {canDispute && (
                <>
                  <Button
                    color="error"
                    variant="outlined"
                    fullWidth
                    startIcon={<GavelOutlinedIcon />}
                    disabled={busy}
                    onClick={() => setDlg({ type: 'dispute' })}
                  >
                    {t('dispute.open')}
                  </Button>
                  {isClient && (
                    <Typography variant="caption" color="text.secondary">
                      {t('order.cancelEscrowNote')}
                    </Typography>
                  )}
                </>
              )}
            </Stack>
            <PolicyNote sx={{ mt: 2 }} />
          </Card>
        </Grid>
      </Grid>

      <SubmitDialog open={dlg?.type === 'submit'} busy={busy} onClose={() => setDlg(null)} onSubmit={submit} />
      <NoteDialog
        open={dlg?.type === 'changes'}
        busy={busy}
        onClose={() => setDlg(null)}
        onSubmit={changes}
        title={t('order.changesTitle')}
        placeholder={t('order.changesPlaceholder')}
        cta={t('common.submit')}
      />
      <NoteDialog
        open={dlg?.type === 'decline'}
        busy={busy}
        onClose={() => setDlg(null)}
        onSubmit={declineOrder}
        title={t('order.declineTitle')}
        label={t('order.declineReason')}
        minLen={0}
        cta={t('order.decline')}
      />
      <DisputeDialog
        open={dlg?.type === 'dispute'}
        busy={busy}
        onClose={() => setDlg(null)}
        onSubmit={openDispute}
        milestones={o.milestones}
      />
    </Container>
  );
}
