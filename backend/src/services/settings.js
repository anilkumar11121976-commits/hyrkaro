import Setting from '../models/Setting.js';
import { env } from '../config/env.js';
import { CATEGORY_SLUGS } from '../config/constants.js';

/**
 * PDF §16: commission is per category and editable by an admin without a deploy.
 * Values are cached for a minute so the hot path (creating an order) stays cheap.
 */
const KEY = 'commission';
let cache = null;
let cachedAt = 0;
const TTL_MS = 60_000;

export const defaultCommission = () => ({
  free: env.commissionFree,
  pro: env.commissionPro,
  // { [categorySlug]: { free, pro } } — only categories the admin overrode.
  byCategory: {},
});

export async function getCommissionSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  const row = await Setting.findOne({ key: KEY }).lean();
  cache = { ...defaultCommission(), ...(row?.value || {}) };
  cachedAt = Date.now();
  return cache;
}

export function invalidateCommissionCache() {
  cache = null;
  cachedAt = 0;
}

export async function saveCommissionSettings(value, adminId) {
  await Setting.updateOne({ key: KEY }, { $set: { value, updatedBy: adminId } }, { upsert: true });
  invalidateCommissionCache();
  return getCommissionSettings({ fresh: true });
}

/** Commission percent for one freelancer, honouring category overrides. */
export async function commissionFor({ category, isPro }) {
  const s = await getCommissionSettings();
  const over = category && s.byCategory?.[category];
  const tier = isPro ? 'pro' : 'free';
  const pct = over?.[tier] ?? s[tier];
  const n = Number(pct);
  // Guard-rail: the PDF caps the band at 5-10%, but allow 0-30 for promos.
  return Number.isFinite(n) ? Math.min(30, Math.max(0, n)) : s[tier];
}

/** Shape the admin UI edits: every category, filled in from the defaults. */
export async function commissionTable() {
  const s = await getCommissionSettings({ fresh: true });
  return {
    defaults: { free: s.free, pro: s.pro },
    categories: CATEGORY_SLUGS.map((slug) => ({
      slug,
      free: s.byCategory?.[slug]?.free ?? s.free,
      pro: s.byCategory?.[slug]?.pro ?? s.pro,
      overridden: Boolean(s.byCategory?.[slug]),
    })),
  };
}
