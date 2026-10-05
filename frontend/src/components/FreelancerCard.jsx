'use client';
import Link from 'next/link';
import { Box, Card, CardActionArea, Chip, Stack, Typography } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { UserAvatar, VerifiedBadge } from './common';
import { useI18n } from '@/i18n/I18nProvider';
import { catName, cityName } from '@/lib/constants';
import { rateLabel } from '@/lib/format';
import { brand } from '@/lib/theme';

export default function FreelancerCard({ p }) {
  const { t } = useI18n();
  const u = p.user || {};
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: brand.purple, transform: 'translateY(-2px)' },
      }}
    >
      <CardActionArea component={Link} href={`/freelancers/${p._id}`} sx={{ p: 2.25, height: '100%', alignItems: 'stretch' }}>
        <Stack spacing={1.5} sx={{ height: '100%', width: '100%' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <UserAvatar user={u} size={52} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {u.name}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                <PlaceOutlinedIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" noWrap>
                  {[p.area, cityName(p.city)].filter(Boolean).join(', ')}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Typography sx={{ fontWeight: 600 }} className="clamp-2">
            {p.title || catName(p.category)}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {(p.skills || []).slice(0, 3).map((s) => (
              <Chip key={s} label={s} size="small" variant="outlined" sx={{ borderColor: brand.line }} />
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <StarRoundedIcon sx={{ color: '#F5A524', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {p.ratingCount ? Number(p.ratingAvg || 0).toFixed(1) : t('search.new')}
              </Typography>
              {p.ratingCount > 0 && (
                <Typography variant="body2" color="text.secondary">
                  ({p.ratingCount})
                </Typography>
              )}
            </Stack>
            <Typography sx={{ fontWeight: 700 }}>{rateLabel(p.rate, t)}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {p.verification?.status === 'verified' && <VerifiedBadge small />}
            {p.verification?.status !== 'verified' && (
              <Chip size="small" variant="outlined" label={t('search.notVerified')} sx={{ borderColor: brand.line }} />
            )}
            {p.remoteOk && p.tier === 'india' && (
              <Chip size="small" variant="outlined" label={t('search.remoteOnly')} sx={{ borderColor: brand.line }} />
            )}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
