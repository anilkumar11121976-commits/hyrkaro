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
  FormControlLabel,
  Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from '@/lib/toast';
import api, { errMsg } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';
import { Loading, PageTitle, RequireAuth, UserAvatar } from '@/components/common';
import { CATEGORIES, KYC_STATUS, ORDER_STATUS, catName, cityName } from '@/lib/constants';
import { date, dateTime, inr, rateLabel } from '@/lib/format';
import { brand } from '@/lib/theme';

/** Shared paging hook so every admin table can walk past page one (report M13). */
function usePaged(path, { params = {}, limit = 25 } = {}) {
  const { t } = useI18n();
  const [state, setState] = useState({ items: null, total: 0, page: 1 });
  const [page, setPage] = useState(1);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(path, { params: { ...JSON.parse(key), page, limit } });
      setState({ items: data.items, total: data.total ?? data.items.length, page });
    } catch (e) {
      toast.error(errMsg(e, t));
      setState({ items: [], total: 0, page });
    }
  }, [path, key, page, limit, t]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [key]);

  return { ...state, page, setPage, reload: load, limit };
}

function Pager({ total, page, setPage, limit }) {
  if (total <= limit) return null;
  return (
    <TablePagination
      component="div"
      count={total}
      page={page - 1}
      onPageChange={(_, p) => setPage(p + 1)}
      rowsPerPage={limit}
      rowsPerPageOptions={[limit]}
    />
  );
}

function Stats() {
  const { t } = useI18n();
  const [s, setS] = useState(null);
  useEffect(() => {
    api
      .get('/admin/stats')
      .then(({ data }) => setS(data.stats))
      .catch(() => {});
  }, []);
  if (!s) return null;
  const cards = [
    [t('admin.statUsers'), s.users],
    [t('admin.statClients'), s.clients],
    [t('admin.statFreelancers'), s.freelancers],
    [t('admin.statPendingV'), s.pendingVerification],
    [t('admin.statKycPending'), s.kycPending],
    [t('admin.statOrders'), `${s.orders} (${s.activeOrders})`],
    [t('admin.statDisputes'), s.disputes],
    [t('admin.statGmv'), inr(s.gmv)],
    [t('admin.statCommission'), inr(s.commissionEarned)],
    [t('admin.statPayoutsDue'), inr(s.payoutsDue)],
    [t('admin.statPayoutsHold'), inr(s.payoutsOnHold)],
    [t('admin.statRefunded'), inr(s.refunded)],
    [t('admin.statRequirements'), s.openRequirements],
    [t('admin.statWaitlist'), s.waitlist],
  ];
  return (
    <Grid container spacing={1.5} sx={{ mb: 3 }}>
      {cards.map(([l, v]) => (
        <Grid key={l} size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card sx={{ p: 1.75 }}>
            <Typography variant="caption" color="text.secondary">
              {l}
            </Typography>
            <Typography variant="h6">{v}</Typography>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

function Verification() {
  const { t } = useI18n();
  const [status, setStatus] = useState('pending');
  const { items, total, page, setPage, reload, limit } = usePaged('/admin/freelancers', { params: { status } });

  const act = async (p, s) => {
    let note = '';
    if (s === 'rejected') {
      note = window.prompt(t('admin.rejectReason')) || '';
      if (!note) return;
    }
    try {
      await api.patch(`/admin/freelancers/${p._id}/verification`, { status: s, note });
      toast.success(s === 'verified' ? t('admin.verified') : t('admin.rejected'));
      reload();
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  };

  return (
    <>
      <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 220, mb: 2 }} label={t('common.status')}>
        {['pending', 'verified', 'rejected', 'incomplete'].map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Typography color="text.secondary">{t('admin.nothingFound')}</Typography>
      ) : (
        <>
          <Stack spacing={1.5}>
            {items.map((p) => (
              <Card key={p._id} sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
                  <UserAvatar user={p.user} size={48} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                      <Typography sx={{ fontWeight: 700 }}>
                        {p.user?.name} · {p.title || '—'}
                      </Typography>
                      {p.user?.contactStrikes > 0 && (
                        <Chip size="small" color="warning" label={t('admin.strikes', { n: p.user.contactStrikes })} />
                      )}
                      <Chip size="small" variant="outlined" label={t(KYC_STATUS[p.user?.kyc?.status || 'none'].key)} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      +91{p.user?.phone} · {p.user?.email || '—'} · {catName(p.category)} · {cityName(p.city)} ·{' '}
                      {rateLabel(p.rate, t)} · {p.portfolio?.length || 0} portfolio · {p.completeness}%
                    </Typography>
                    <Typography variant="body2" className="clamp-2" sx={{ mt: 0.5 }}>
                      {p.bio}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button component={Link} href={`/freelancers/${p._id}`} target="_blank" size="small">
                      {t('common.view')}
                    </Button>
                    {p.verification.status !== 'verified' && (
                      <Button size="small" variant="contained" color="secondary" onClick={() => act(p, 'verified')}>
                        {t('admin.verify')}
                      </Button>
                    )}
                    {p.verification.status !== 'rejected' && (
                      <Button size="small" color="error" onClick={() => act(p, 'rejected')}>
                        {t('admin.reject')}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Stack>
          <Pager total={total} page={page} setPage={setPage} limit={limit} />
        </>
      )}
    </>
  );
}

/** PDF §12: KYC review queue. */
function Kyc() {
  const { t } = useI18n();
  const [status, setStatus] = useState('pending');
  const { items, total, page, setPage, reload, limit } = usePaged('/admin/kyc', { params: { status } });

  const act = async (u, s) => {
    let note = '';
    if (s === 'rejected') {
      note = window.prompt(t('admin.rejectReason')) || '';
      if (!note) return;
    }
    try {
      const { data } = await api.patch(`/admin/kyc/${u._id}`, { status: s, note });
      toast.success(s === 'verified' ? t('admin.verified') : t('admin.rejected'));
      if (data.payoutsReleased) toast.info(`${data.payoutsReleased} payout released`);
      reload();
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  };

  return (
    <>
      <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 220, mb: 2 }} label={t('common.status')}>
        {['pending', 'verified', 'rejected', 'none'].map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Typography color="text.secondary">{t('admin.nothingFound')}</Typography>
      ) : (
        <>
          <Stack spacing={1.5}>
            {items.map((u) => (
              <Card key={u._id} sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {u.name} · +91{u.phone}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('kyc.legalName')}: {u.kyc?.legalName} · PAN ••••{u.kyc?.panLast4} ·{' '}
                      {u.kyc?.payout?.method === 'upi'
                        ? `UPI ${u.kyc.payout.upiId}`
                        : `${u.kyc?.payout?.bankName || ''} ••••${u.kyc?.payout?.accountLast4 || ''} / ${u.kyc?.payout?.ifsc || ''}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dateTime(u.kyc?.submittedAt)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    {u.kyc?.status !== 'verified' && (
                      <Button size="small" variant="contained" color="secondary" onClick={() => act(u, 'verified')}>
                        {t('admin.approveKyc')}
                      </Button>
                    )}
                    {u.kyc?.status !== 'rejected' && (
                      <Button size="small" color="error" onClick={() => act(u, 'rejected')}>
                        {t('admin.rejectKyc')}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Stack>
          <Pager total={total} page={page} setPage={setPage} limit={limit} />
        </>
      )}
    </>
  );
}

function Users() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState({ q: '', role: '', flagged: false });
  const { items, total, page, setPage, reload, limit } = usePaged('/admin/users', {
    params: { ...(applied.q ? { q: applied.q } : {}), ...(applied.role ? { role: applied.role } : {}), ...(applied.flagged ? { flagged: true } : {}) },
  });

  const block = async (u) => {
    const action = u.isBlocked ? t('admin.unblock') : t('admin.block');
    if (!window.confirm(t('admin.blockConfirm', { name: u.name, action }))) return;
    let reason = '';
    if (!u.isBlocked) {
      reason = window.prompt(t('admin.blockReason')) || '';
      if (!reason) return;
    }
    try {
      await api.patch(`/admin/users/${u._id}/block`, { blocked: !u.isBlocked, reason });
      reload();
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  };

  return (
    <>
      <Stack
        component="form"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 2 }}
        onSubmit={(e) => {
          e.preventDefault();
          setApplied((a) => ({ ...a, q }));
        }}
      >
        <TextField size="small" placeholder={t('admin.searchUsers')} value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 320 }} />
        <TextField
          select
          size="small"
          value={applied.role}
          onChange={(e) => setApplied((a) => ({ ...a, role: e.target.value }))}
          sx={{ width: 160 }}
          label={t('common.role')}
        >
          <MenuItem value="">{t('common.all')}</MenuItem>
          <MenuItem value="client">client</MenuItem>
          <MenuItem value="freelancer">freelancer</MenuItem>
          <MenuItem value="admin">admin</MenuItem>
        </TextField>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={applied.flagged}
              onChange={(e) => setApplied((a) => ({ ...a, flagged: e.target.checked }))}
              color="secondary"
            />
          }
          label={t('admin.flaggedOnly')}
        />
        <Button type="submit" variant="contained">
          {t('common.search')}
        </Button>
      </Stack>
      {!items ? (
        <Loading />
      ) : (
        <>
          <TableContainer component={Card}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('common.phone')}</TableCell>
                  <TableCell>{t('common.role')}</TableCell>
                  <TableCell>KYC</TableCell>
                  <TableCell>{t('common.date')}</TableCell>
                  <TableCell align="right">{t('common.action')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell>
                      {u.name}
                      {u.contactStrikes > 0 && (
                        <Chip size="small" color="warning" sx={{ ml: 1 }} label={t('admin.strikes', { n: u.contactStrikes })} />
                      )}
                    </TableCell>
                    <TableCell>+91{u.phone}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>{u.kyc?.status || 'none'}</TableCell>
                    <TableCell>{date(u.createdAt)}</TableCell>
                    <TableCell align="right">
                      {u.role !== 'admin' && (
                        <Button size="small" color={u.isBlocked ? 'secondary' : 'error'} onClick={() => block(u)}>
                          {u.isBlocked ? t('admin.unblock') : t('admin.block')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pager total={total} page={page} setPage={setPage} limit={limit} />
        </>
      )}
    </>
  );
}

function Orders() {
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const { items, total, page, setPage, limit } = usePaged('/admin/orders', { params: status ? { status } : {} });
  if (!items) return <Loading />;
  return (
    <>
      <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 240, mb: 2 }} label={t('common.status')}>
        <MenuItem value="">{t('common.all')}</MenuItem>
        {Object.keys(ORDER_STATUS).map((s) => (
          <MenuItem key={s} value={s}>
            {t(ORDER_STATUS[s].key)}
          </MenuItem>
        ))}
      </TextField>
      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>{t('order.client')}</TableCell>
              <TableCell>{t('order.freelancer')}</TableCell>
              <TableCell>{t('common.amount')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((o) => (
              <TableRow key={o._id}>
                <TableCell>
                  <Link href={`/orders/${o._id}`}>{o.orderNo}</Link>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {o.title}
                  </Typography>
                </TableCell>
                <TableCell>{o.client?.name}</TableCell>
                <TableCell>{o.freelancer?.name}</TableCell>
                <TableCell>{inr(o.amount)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={ORDER_STATUS[o.status] ? t(ORDER_STATUS[o.status].key) : o.status}
                    color={ORDER_STATUS[o.status]?.color}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager total={total} page={page} setPage={setPage} limit={limit} />
    </>
  );
}

/** PDF §10: the admin decides from chat, offer card and delivered files. */
function Disputes() {
  const { t } = useI18n();
  const { items, total, page, setPage, reload, limit } = usePaged('/admin/disputes');
  const [target, setTarget] = useState(null);
  const [f, setF] = useState({ outcome: 'split', clientPercent: 50, note: '' });
  const [busy, setBusy] = useState(false);

  const open = (o) => {
    setTarget(o);
    setF({ outcome: 'split', clientPercent: 50, note: '' });
  };

  const resolve = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/disputes/${target._id}/resolve`, {
        outcome: f.outcome,
        ...(f.outcome === 'split' ? { clientPercent: Number(f.clientPercent) } : {}),
        note: f.note.trim(),
      });
      toast.success(t('admin.resolved'));
      setTarget(null);
      reload();
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (!items) return <Loading />;
  if (!items.length) return <Typography color="text.secondary">{t('admin.disputesNone')}</Typography>;

  return (
    <>
      <Stack spacing={1.5}>
        {items.map((o) => {
          const held = o.milestones
            .filter((m) => ['funded', 'submitted', 'changes_requested'].includes(m.status))
            .reduce((s, m) => s + m.amount, 0);
          return (
            <Card key={o._id} sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    <Link href={`/orders/${o._id}`}>{o.orderNo}</Link> · {o.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {o.client?.name} (+91{o.client?.phone}) ↔ {o.freelancer?.name} (+91{o.freelancer?.phone}) ·{' '}
                    {t('admin.escrowHeld', { amount: inr(held) })}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {t('dispute.raisedBy', { name: o.dispute?.raisedBy?.name || '' })} · {dateTime(o.dispute?.openedAt)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                    {o.dispute?.reason}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" component={Link} href={`/inbox/${o.conversation}`} target="_blank">
                    {t('order.openChat')}
                  </Button>
                  <Button size="small" variant="contained" onClick={() => open(o)}>
                    {t('admin.resolveDispute')}
                  </Button>
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </Stack>
      <Pager total={total} page={page} setPage={setPage} limit={limit} />

      <Dialog open={Boolean(target)} onClose={() => setTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('admin.resolveTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <RadioGroup value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>
              <FormControlLabel value="client" control={<Radio color="secondary" />} label={t('admin.outcomeClient')} />
              <FormControlLabel value="freelancer" control={<Radio color="secondary" />} label={t('admin.outcomeFreelancer')} />
              <FormControlLabel value="split" control={<Radio color="secondary" />} label={t('admin.outcomeSplit')} />
            </RadioGroup>
            {f.outcome === 'split' && (
              <TextField
                label={t('admin.clientPercent')}
                type="number"
                value={f.clientPercent}
                onChange={(e) => setF({ ...f, clientPercent: e.target.value })}
                slotProps={{ htmlInput: { min: 0, max: 100 } }}
              />
            )}
            <TextField
              label={t('admin.resolveNote')}
              multiline
              minRows={3}
              value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTarget(null)} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button variant="contained" disabled={busy || f.note.trim().length < 5} onClick={resolve}>
            {t('admin.resolveDispute')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Payouts() {
  const { t } = useI18n();
  const [status, setStatus] = useState('due');
  const { items, total, page, setPage, reload, limit } = usePaged('/admin/payouts', { params: { status }, limit: 50 });

  const paid = async (p) => {
    const reference = window.prompt(t('admin.markPaidPrompt', { name: p.freelancer?.name, amount: inr(p.amount) }));
    if (!reference) return;
    try {
      await api.post(`/admin/payouts/${p.orderId}/${p.milestoneId}/paid`, { reference });
      toast.success(t('admin.markedPaid'));
      reload();
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  };

  if (!items) return <Loading />;
  return (
    <>
      <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 220, mb: 2 }} label={t('common.status')}>
        {['due', 'on_hold', 'paid'].map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>
      {!items.length ? (
        <Typography color="text.secondary">{t('admin.payoutsNone')}</Typography>
      ) : (
        <>
          <TableContainer component={Card}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('order.freelancer')}</TableCell>
                  <TableCell>Order / milestone</TableCell>
                  <TableCell>Payout</TableCell>
                  <TableCell>{t('order.commission')}</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={`${p.orderId}-${p.milestoneId}`}>
                    <TableCell>
                      {p.freelancer?.name}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        +91{p.freelancer?.phone} ·{' '}
                        {p.freelancer?.payout?.method === 'upi'
                          ? p.freelancer.payout.upiId
                          : `••••${p.freelancer?.payout?.accountLast4 || ''} ${p.freelancer?.payout?.ifsc || ''}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.orderNo} · {p.milestoneTitle}
                    </TableCell>
                    <TableCell>{inr(p.amount)}</TableCell>
                    <TableCell>{inr(p.commission)}</TableCell>
                    <TableCell>{date(p.dueAt)}</TableCell>
                    <TableCell align="right">
                      {p.payoutStatus === 'due' ? (
                        <Button size="small" variant="contained" onClick={() => paid(p)}>
                          {t('admin.markPaid')}
                        </Button>
                      ) : p.payoutStatus === 'on_hold' ? (
                        <Chip size="small" color="warning" label={t('admin.payoutHold', { reason: p.holdReason || '' })} />
                      ) : (
                        <Chip size="small" color="success" label="paid" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pager total={total} page={page} setPage={setPage} limit={limit} />
        </>
      )}
    </>
  );
}

/** PDF §14: fake or wrong reviews can be removed. */
function Reviews() {
  const { t } = useI18n();
  const { items, total, page, setPage, reload, limit } = usePaged('/admin/reviews', { limit: 30 });

  const toggle = async (r) => {
    let reason = '';
    if (!r.hidden) {
      reason = window.prompt(t('admin.hideReason')) || '';
      if (!reason) return;
    }
    try {
      await api.patch(`/admin/reviews/${r._id}/hidden`, { hidden: !r.hidden, reason });
      toast.success(t('admin.reviewHidden'));
      reload();
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  };

  if (!items) return <Loading />;
  return (
    <>
      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>{t('order.client')}</TableCell>
              <TableCell>{t('order.freelancer')}</TableCell>
              <TableCell>★</TableCell>
              <TableCell>{t('order.review')}</TableCell>
              <TableCell align="right">{t('common.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r._id} sx={{ opacity: r.hidden ? 0.5 : 1 }}>
                <TableCell>{r.order?.orderNo}</TableCell>
                <TableCell>{r.client?.name}</TableCell>
                <TableCell>{r.freelancer?.name}</TableCell>
                <TableCell>{r.rating}</TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  <Typography variant="body2" className="clamp-2">
                    {r.comment}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" color={r.hidden ? 'secondary' : 'error'} onClick={() => toggle(r)}>
                    {r.hidden ? t('admin.unhideReview') : t('admin.hideReview')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager total={total} page={page} setPage={setPage} limit={limit} />
    </>
  );
}

/** PDF §16: commission per category, no deploy needed. */
function Commission() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/admin/commission');
      setData(d);
    } catch (e) {
      toast.error(errMsg(e, t));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const byCategory = {};
      data.categories.forEach((c) => {
        if (Number(c.free) !== Number(data.defaults.free) || Number(c.pro) !== Number(data.defaults.pro)) {
          byCategory[c.slug] = { free: Number(c.free), pro: Number(c.pro) };
        }
      });
      const { data: d } = await api.put('/admin/commission', {
        free: Number(data.defaults.free),
        pro: Number(data.defaults.pro),
        byCategory,
      });
      setData(d);
      toast.success(t('admin.commissionSaved'));
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Loading />;

  const setCat = (slug, key, value) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.slug === slug ? { ...c, [key]: value } : c)) }));

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="h6">{t('admin.commissionTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('admin.commissionHelp')}
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, maxWidth: 400 }}>
        <TextField
          size="small"
          label={`${t('admin.commissionDefault')} · ${t('admin.commissionFree')}`}
          type="number"
          value={data.defaults.free}
          onChange={(e) => setData((d) => ({ ...d, defaults: { ...d.defaults, free: e.target.value } }))}
        />
        <TextField
          size="small"
          label={`${t('admin.commissionDefault')} · ${t('admin.commissionPro')}`}
          type="number"
          value={data.defaults.pro}
          onChange={(e) => setData((d) => ({ ...d, defaults: { ...d.defaults, pro: e.target.value } }))}
        />
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.category')}</TableCell>
              <TableCell width={140}>{t('admin.commissionFree')}</TableCell>
              <TableCell width={140}>{t('admin.commissionPro')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.categories.map((c) => (
              <TableRow key={c.slug}>
                <TableCell>
                  {CATEGORIES.find((x) => x.slug === c.slug)?.name || c.slug}
                  {c.overridden && <Chip size="small" sx={{ ml: 1, bgcolor: brand.soft }} label="custom" />}
                </TableCell>
                <TableCell>
                  <TextField size="small" type="number" value={c.free} onChange={(e) => setCat(c.slug, 'free', e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" type="number" value={c.pro} onChange={(e) => setCat(c.slug, 'pro', e.target.value)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button variant="contained" sx={{ mt: 2 }} onClick={save} disabled={busy}>
        {busy ? t('common.saving') : t('common.save')}
      </Button>
    </Card>
  );
}

/** PDF §16: every admin action is logged. */
function Logs() {
  const { t } = useI18n();
  const { items, total, page, setPage, limit } = usePaged('/admin/logs', { limit: 50 });
  if (!items) return <Loading />;
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('admin.logsHelp')}
      </Alert>
      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.date')}</TableCell>
              <TableCell>{t('admin.logAdmin')}</TableCell>
              <TableCell>{t('admin.logAction')}</TableCell>
              <TableCell>{t('admin.logSummary')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((l) => (
              <TableRow key={l._id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateTime(l.createdAt)}</TableCell>
                <TableCell>{l.adminName}</TableCell>
                <TableCell>
                  <Chip size="small" label={l.action} variant="outlined" />
                </TableCell>
                <TableCell sx={{ maxWidth: 380 }}>
                  <Typography variant="body2" className="clamp-2">
                    {l.summary}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager total={total} page={page} setPage={setPage} limit={limit} />
    </>
  );
}

function Requirements() {
  const { t } = useI18n();
  const { items, total, page, setPage, limit } = usePaged('/admin/requirements', { limit: 30 });
  if (!items) return <Loading />;
  return (
    <>
      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('requirement.workTitle')}</TableCell>
              <TableCell>{t('order.client')}</TableCell>
              <TableCell>{t('common.category')}</TableCell>
              <TableCell>{t('requirement.interestCount', { count: '' }).trim()}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r._id}>
                <TableCell>
                  <Link href={`/requirements/${r._id}`}>{r.title}</Link>
                </TableCell>
                <TableCell>{r.client?.name}</TableCell>
                <TableCell>{catName(r.category)}</TableCell>
                <TableCell>{r.interestCount || 0}</TableCell>
                <TableCell>{r.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager total={total} page={page} setPage={setPage} limit={limit} />
    </>
  );
}

function Waitlist() {
  const { t } = useI18n();
  const { items, total, page, setPage, limit } = usePaged('/admin/waitlist', { limit: 50 });
  if (!items) return <Loading />;
  return (
    <>
      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.name')}</TableCell>
              <TableCell>{t('common.email')}</TableCell>
              <TableCell>{t('common.phone')}</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>{t('common.city')}</TableCell>
              <TableCell>{t('common.date')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((w) => (
              <TableRow key={w._id}>
                <TableCell>{w.name}</TableCell>
                <TableCell>{w.email}</TableCell>
                <TableCell>{w.phone}</TableCell>
                <TableCell>{w.type}</TableCell>
                <TableCell>
                  {cityName(w.city)} {w.category ? `· ${catName(w.category)}` : ''}
                </TableCell>
                <TableCell>{date(w.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager total={total} page={page} setPage={setPage} limit={limit} />
    </>
  );
}

export default function AdminView() {
  const { t } = useI18n();
  const [tab, setTab] = useState('verify');
  const TABS = [
    ['verify', t('admin.tabVerification'), Verification],
    ['kyc', t('admin.tabKyc'), Kyc],
    ['users', t('admin.tabUsers'), Users],
    ['orders', t('admin.tabOrders'), Orders],
    ['disputes', t('admin.tabDisputes'), Disputes],
    ['payouts', t('admin.tabPayouts'), Payouts],
    ['reviews', t('admin.tabReviews'), Reviews],
    ['commission', t('admin.tabCommission'), Commission],
    ['requirements', t('admin.tabRequirements'), Requirements],
    ['logs', t('admin.tabLogs'), Logs],
    ['waitlist', t('admin.tabWaitlist'), Waitlist],
  ];
  const Active = TABS.find(([v]) => v === tab)?.[2] || Verification;

  return (
    <RequireAuth roles={['admin']}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PageTitle title={t('admin.title')} subtitle={t('admin.subtitle')} />
        <Stats />
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          textColor="secondary"
          indicatorColor="secondary"
          sx={{ mb: 2 }}
        >
          {TABS.map(([v, label]) => (
            <Tab key={v} value={v} label={label} />
          ))}
        </Tabs>
        <Active />
      </Container>
    </RequireAuth>
  );
}
