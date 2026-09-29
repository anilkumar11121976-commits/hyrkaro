import { RATE_UNIT_KEY } from './constants';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Rate label needs the dictionary for the unit, so callers pass t().
 * Without t() it falls back to the Hinglish suffixes.
 */
export const rateLabel = (rate, t) => {
  if (!rate?.amount) return t ? t('profile.chargesLabel') : 'Charges chat mein poochho';
  const fallback = { hour: '/ghanta', day: '/din', project: '/project' }[rate.unit] || '';
  const unit = t ? t(RATE_UNIT_KEY[rate.unit] || 'common.perProject') : fallback;
  return `${inr(rate.amount)}${unit}`;
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fileSize = (b = 0) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
