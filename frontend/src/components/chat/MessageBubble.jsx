'use client';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useI18n } from '@/i18n/I18nProvider';
import { MEET_STATUS, OFFER_STATUS } from '@/lib/constants';
import { dateTime, fileSize, inr } from '@/lib/format';
import { brand } from '@/lib/theme';

function Time({ m, mine }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end', mt: 0.5, opacity: 0.7 }}>
      <Typography variant="caption">{dateTime(m.createdAt)}</Typography>
      {mine && m.readAt && <DoneAllIcon sx={{ fontSize: 14 }} />}
    </Stack>
  );
}

export default function MessageBubble({ m, mine, isClient, onOffer, onMeeting, onHire, busy }) {
  const { t } = useI18n();

  if (m.type === 'system') {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'flex-start',
          alignSelf: 'center',
          maxWidth: 560,
          bgcolor: '#F6F4FA',
          borderRadius: 2,
          px: 1.5,
          py: 1,
          my: 0.5,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16, color: brand.purple, mt: '3px' }} />
        <Typography variant="body2" color="text.secondary">
          {m.text}
        </Typography>
      </Stack>
    );
  }

  const bubble = {
    alignSelf: mine ? 'flex-end' : 'flex-start',
    maxWidth: { xs: '88%', sm: '72%' },
    bgcolor: mine ? brand.ink : '#F4F2F8',
    color: mine ? '#fff' : brand.ink,
    borderRadius: 3,
    borderBottomRightRadius: mine ? 6 : 24,
    borderBottomLeftRadius: mine ? 24 : 6,
    px: 1.75,
    py: 1.25,
    flexShrink: 0,
  };

  if (m.type === 'offer') {
    const o = m.offer;
    const st = OFFER_STATUS[o.status] || OFFER_STATUS.pending;
    return (
      <Box sx={{ ...bubble, bgcolor: '#fff', color: brand.ink, border: `1.5px solid ${brand.lilac}`, minWidth: 260 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <LocalOfferOutlinedIcon sx={{ color: brand.purple, fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {mine ? t('offer.yours') : t('offer.new')}
            </Typography>
          </Stack>
          <Chip size="small" label={t(st.key)} color={st.color} variant={st.color === 'default' ? 'outlined' : 'filled'} />
        </Stack>
        <Typography variant="h5" sx={{ mt: 1 }}>
          {inr(o.amount)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('offer.deliveryIn', { days: o.deliveryDays })}
        </Typography>
        {o.description && <Typography sx={{ mt: 1, whiteSpace: 'pre-line' }}>{o.description}</Typography>}
        {o.status === 'pending' && !mine && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5 }} useFlexGap>
            <Button size="small" variant="contained" disabled={busy} onClick={() => onOffer(m, 'accept')}>
              {t('offer.accept')}
            </Button>
            <Button size="small" variant="outlined" disabled={busy} onClick={() => onOffer(m, 'counter')}>
              {t('offer.counter')}
            </Button>
            <Button size="small" color="inherit" disabled={busy} onClick={() => onOffer(m, 'decline')}>
              {t('offer.decline')}
            </Button>
          </Stack>
        )}
        {o.status === 'pending' && mine && (
          <Button size="small" color="inherit" sx={{ mt: 1 }} disabled={busy} onClick={() => onOffer(m, 'withdraw')}>
            {t('offer.withdraw')}
          </Button>
        )}
        {o.status === 'accepted' && isClient && (
          <Button size="small" variant="contained" color="secondary" sx={{ mt: 1.5 }} onClick={() => onHire(m)}>
            {t('offer.hireOnThis')}
          </Button>
        )}
        <Time m={m} mine={mine} />
      </Box>
    );
  }

  if (m.type === 'meeting') {
    const mt = m.meeting;
    const st = MEET_STATUS[mt.status] || MEET_STATUS.proposed;
    return (
      <Box sx={{ ...bubble, bgcolor: '#fff', color: brand.ink, border: `1.5px solid ${brand.lilac}`, minWidth: 260 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <VideocamOutlinedIcon sx={{ color: brand.purple, fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {t('meeting.videoMeeting')}
            </Typography>
          </Stack>
          <Chip size="small" label={t(st.key)} color={st.color} variant={st.color === 'default' ? 'outlined' : 'filled'} />
        </Stack>
        <Typography sx={{ fontWeight: 700, mt: 1 }}>{dateTime(mt.when)}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('meeting.minutes', { n: mt.mins })} · {mt.topic}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5 }} useFlexGap>
          {mt.status === 'proposed' && !mine && (
            <>
              <Button size="small" variant="contained" disabled={busy} onClick={() => onMeeting(m, 'confirm')}>
                {t('meeting.confirm')}
              </Button>
              <Button size="small" color="inherit" disabled={busy} onClick={() => onMeeting(m, 'decline')}>
                {t('meeting.decline')}
              </Button>
            </>
          )}
          {mt.status === 'confirmed' && (
            <Button
              size="small"
              variant="contained"
              color="secondary"
              href={mt.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('meeting.join')}
            </Button>
          )}
          {['proposed', 'confirmed'].includes(mt.status) && mine && (
            <Button size="small" color="inherit" disabled={busy} onClick={() => onMeeting(m, 'cancel')}>
              {t('meeting.cancel')}
            </Button>
          )}
        </Stack>
        <Time m={m} mine={mine} />
      </Box>
    );
  }

  if (m.type === 'file') {
    const f = m.file || {};
    const isImg = f.mime?.startsWith('image/');
    // PDF §5: files are purged 6 months after the order completes.
    if (f.purgedAt) {
      return (
        <Box sx={bubble}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', opacity: 0.7 }}>
            <InsertDriveFileOutlinedIcon />
            <Typography variant="body2">{f.name}</Typography>
          </Stack>
          <Time m={m} mine={mine} />
        </Box>
      );
    }
    return (
      <Box sx={bubble}>
        {isImg ? (
          <Box component="a" href={f.url} target="_blank" rel="noopener noreferrer">
            <Box
              component="img"
              src={f.url}
              alt={f.name}
              sx={{ maxWidth: '100%', maxHeight: 260, borderRadius: 2, display: 'block' }}
            />
          </Box>
        ) : (
          <Stack
            component="a"
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center' }}
          >
            <InsertDriveFileOutlinedIcon />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, wordBreak: 'break-all' }}>{f.name}</Typography>
              <Typography variant="caption">{fileSize(f.size)}</Typography>
            </Box>
          </Stack>
        )}
        {m.text && <Typography sx={{ mt: 1, whiteSpace: 'pre-line' }}>{m.text}</Typography>}
        <Time m={m} mine={mine} />
      </Box>
    );
  }

  return (
    <Box sx={bubble}>
      <Typography sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{m.text}</Typography>
      {m.flagged && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
          {t('chat.contactHidden')}
        </Typography>
      )}
      <Time m={m} mine={mine} />
    </Box>
  );
}
