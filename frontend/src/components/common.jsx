'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, Badge, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { useSocket } from '@/context/SocketContext';
import { initials } from '@/lib/format';
import { brand } from '@/lib/theme';

export function Logo({ size = 36, dark = false }) {
  return (
    <Box component={Link} href="/" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }} aria-label="HyrKro home">
      <Box component="img" src="/logo-icon.svg" alt="" width={size} height={size} sx={{ borderRadius: '10px', display: 'block' }} />
      <Typography
        component="span"
        sx={{
          fontFamily: "'Bricolage Grotesque Variable', sans-serif",
          fontWeight: 800,
          fontSize: size * 0.72,
          letterSpacing: '-0.03em',
          color: dark ? '#fff' : brand.ink,
          lineHeight: 1,
        }}
      >
        Hyr
        <Box component="span" sx={{ color: dark ? brand.lilac : brand.purple }}>
          Kro
        </Box>
      </Typography>
    </Box>
  );
}

export function UserAvatar({ user, size = 40, sx, showPresence = false }) {
  const { onlineUsers } = useSocket();
  const avatar = (
    <Avatar
      src={user?.avatar?.url || undefined}
      alt={user?.name || ''}
      sx={{ width: size, height: size, bgcolor: brand.lilac, color: brand.ink, fontWeight: 700, fontSize: size * 0.38, ...sx }}
    >
      {initials(user?.name)}
    </Avatar>
  );
  // Presence only reaches people you actually chat with (report H2).
  if (!showPresence || !user?._id || onlineUsers[String(user._id)] === undefined) return avatar;
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      sx={{
        '& .MuiBadge-badge': {
          bgcolor: onlineUsers[String(user._id)] ? '#2E9E5B' : '#B9B4C4',
          boxShadow: '0 0 0 2px #fff',
          width: 10,
          height: 10,
          borderRadius: '50%',
        },
      }}
    >
      {avatar}
    </Badge>
  );
}

export function VerifiedBadge({ small }) {
  const { t } = useI18n();
  return (
    <Chip
      size="small"
      icon={<VerifiedIcon sx={{ fontSize: small ? 14 : 16 }} />}
      label={t('profile.verifiedBadge')}
      sx={{ bgcolor: brand.soft, color: brand.deep, '& .MuiChip-icon': { color: brand.purple }, height: small ? 22 : 26 }}
    />
  );
}

export function Loading({ label, minHeight = 240 }) {
  const { t } = useI18n();
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', minHeight }}>
      <CircularProgress color="secondary" size={32} />
      <Typography color="text.secondary">{label || t('common.loading')}</Typography>
    </Stack>
  );
}

export function EmptyState({ title, text, action, href, onAction, icon }) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', py: 6, px: 2, textAlign: 'center' }}>
      {icon || <Box component="img" src="/mascot.svg" alt="" sx={{ width: 110, opacity: 0.95 }} />}
      <Typography variant="h6">{title}</Typography>
      {text && (
        <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
          {text}
        </Typography>
      )}
      {action &&
        (href ? (
          <Button component={Link} href={href} variant="contained">
            {action}
          </Button>
        ) : (
          <Button onClick={onAction} variant="contained">
            {action}
          </Button>
        ))}
    </Stack>
  );
}

export function PolicyNote({ sx }) {
  const { t } = useI18n();
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', bgcolor: brand.soft, borderRadius: 2, p: 1.5, ...sx }}>
      <ShieldOutlinedIcon sx={{ color: brand.purple, fontSize: 20, mt: '2px' }} />
      <Typography variant="body2" sx={{ color: brand.deep }}>
        {t('chat.safetyLine')}
      </Typography>
    </Stack>
  );
}

/** Client-side route guard. roles: optional array of allowed roles. */
export function RequireAuth({ children, roles }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace('/');
  }, [ready, user, allowed, router, pathname]);

  if (!ready || !allowed) return <Loading />;
  return children;
}

export function PageTitle({ title, subtitle, action }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'space-between', mb: 3 }}
    >
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}
