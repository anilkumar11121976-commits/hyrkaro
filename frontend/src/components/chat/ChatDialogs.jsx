'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useI18n } from '@/i18n/I18nProvider';
import { MS_PLANS } from '@/lib/constants';
import { inr } from '@/lib/format';
import { brand } from '@/lib/theme';

export function OfferDialog({ open, onClose, onSubmit, prev, busy }) {
  const { t } = useI18n();
  const [f, setF] = useState({ amount: '', deliveryDays: '7', description: '' });
  useEffect(() => {
    if (open) {
      setF({
        amount: prev?.amount ? String(prev.amount) : '',
        deliveryDays: String(prev?.deliveryDays || 7),
        description: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const valid = Number(f.amount) >= 100 && Number(f.deliveryDays) >= 1;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{prev ? t('offer.counterTitle') : t('offer.sendTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {prev && (
            <Typography variant="body2" color="text.secondary">
              {t('offer.previous', { amount: inr(prev.amount), days: prev.deliveryDays })}
            </Typography>
          )}
          <TextField
            label={t('offer.amountLabel')}
            type="number"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
              htmlInput: { min: 100 },
            }}
            autoFocus
          />
          <TextField
            label={t('offer.deliveryLabel')}
            type="number"
            value={f.deliveryDays}
            onChange={(e) => setF({ ...f, deliveryDays: e.target.value })}
            slotProps={{ htmlInput: { min: 1, max: 365 } }}
          />
          <TextField
            label={t('offer.workLabel')}
            multiline
            minRows={3}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || busy}
          onClick={() =>
            onSubmit({
              amount: Math.round(Number(f.amount)),
              deliveryDays: Number(f.deliveryDays),
              description: f.description,
            })
          }
        >
          {t('offer.sendButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function MeetingDialog({ open, onClose, onSubmit, busy }) {
  const { t } = useI18n();
  const [f, setF] = useState({ when: '', mins: 30, topic: '' });
  useEffect(() => {
    if (open) {
      const d = new Date(Date.now() + 24 * 3600 * 1000);
      d.setMinutes(0, 0, 0);
      d.setHours(11);
      setF({ when: toLocalInput(d), mins: 30, topic: t('meeting.topic') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('meeting.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('meeting.dateTime')}
            type="datetime-local"
            value={f.when}
            onChange={(e) => setF({ ...f, when: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField select label={t('meeting.duration')} value={f.mins} onChange={(e) => setF({ ...f, mins: e.target.value })}>
            {[15, 30, 45, 60].map((m) => (
              <MenuItem key={m} value={m}>
                {t('meeting.minutes', { n: m })}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('meeting.topic')} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
          <Typography variant="body2" color="text.secondary">
            {t('meeting.note')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!f.when || busy}
          onClick={() => onSubmit({ when: new Date(f.when).toISOString(), mins: Number(f.mins), topic: f.topic })}
        >
          {t('meeting.sendRequest')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Report C4: hiring now always comes from an accepted offer — there is no
 * free-text amount any more, so the freelancer has agreed to the number.
 */
export function HireDialog({ open, onClose, onSubmit, offer, busy, freelancerName }) {
  const { t } = useI18n();
  const [f, setF] = useState({ title: '', description: '', plan: 1 });

  useEffect(() => {
    if (open) setF({ title: '', description: offer?.offer?.description || '', plan: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amount = offer?.offer?.amount || 0;
  const plan = MS_PLANS.find((p) => p.value === Number(f.plan)) || MS_PLANS[0];
  const parts = useMemo(() => {
    let used = 0;
    return plan.split.map((pct, i) => {
      const a = i === plan.split.length - 1 ? amount - used : Math.floor((amount * pct) / 100);
      used += a;
      return a;
    });
  }, [plan, amount]);

  const planNames = [t('hire.planOnce'), t('hire.plan2'), t('hire.plan3')];
  const valid = Boolean(offer) && f.title.trim().length >= 3 && amount >= 100;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('hire.title', { name: freelancerName || '' })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {offer ? (
            <Alert severity="success" icon={false}>
              {t('hire.acceptedOffer', { amount: inr(amount), days: offer.offer.deliveryDays })}
            </Alert>
          ) : (
            <Alert severity="warning" icon={false}>
              {t('hire.needOffer')}
            </Alert>
          )}
          <TextField
            label={t('hire.workTitle')}
            placeholder={t('hire.workTitlePlaceholder')}
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            autoFocus
            disabled={!offer}
          />
          <TextField
            label={t('hire.workDetails')}
            multiline
            minRows={3}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            disabled={!offer}
          />
          {offer && (
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{t('hire.paymentHow')}</Typography>
              <RadioGroup row value={f.plan} onChange={(e) => setF({ ...f, plan: Number(e.target.value) })}>
                {MS_PLANS.map((p, i) => (
                  <FormControlLabel key={p.value} value={p.value} control={<Radio color="secondary" />} label={planNames[i]} />
                ))}
              </RadioGroup>
              {amount >= 100 && (
                <Box sx={{ bgcolor: brand.soft, borderRadius: 2, p: 1.5 }}>
                  {parts.map((a, i) => (
                    <Stack key={i} direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography variant="body2">{t('hire.part', { n: i + 1 })}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {inr(a)}
                      </Typography>
                    </Stack>
                  ))}
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', mt: 1, pt: 1, borderTop: `1px solid ${brand.lilac}` }}
                  >
                    <Typography variant="body2">{t('common.clientFee')}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ₹0
                    </Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 700 }}>{t('common.total')}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{inr(amount)}</Typography>
                  </Stack>
                </Box>
              )}
            </Box>
          )}
          {offer && (
            <Typography variant="body2" color="text.secondary">
              {t('hire.firstOnly', { amount: inr(parts[0] || 0) })}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || busy}
          onClick={() =>
            onSubmit({
              title: f.title.trim(),
              description: f.description.trim(),
              plan: Number(f.plan),
              offerMessageId: offer._id,
            })
          }
        >
          {busy ? t('hire.working') : t('hire.button', { amount: inr(parts[0] || 0) })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
