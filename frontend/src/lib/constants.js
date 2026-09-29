// Keep in sync with backend/src/config/constants.js

export const SITE_NAME = 'HyrKro';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const CATEGORIES = [
  { slug: 'web-app-development', name: 'Web & App Development', role: 'Web Developer', emoji: '💻' },
  { slug: 'graphic-design', name: 'Graphic Design', role: 'Graphic Designer', emoji: '🎨' },
  { slug: 'digital-marketing', name: 'Digital Marketing', role: 'Digital Marketer', emoji: '📈' },
  { slug: 'content-writing', name: 'Content Writing', role: 'Content Writer', emoji: '✍️' },
  { slug: 'video-photography', name: 'Video & Photography', role: 'Video Editor', emoji: '🎬' },
  { slug: 'influencers', name: 'Influencers', role: 'Influencer', emoji: '⭐' },
  { slug: 'social-media', name: 'Social Media Management', role: 'Social Media Manager', emoji: '📱' },
  { slug: 'virtual-assistant', name: 'Virtual Assistant & Data Entry', role: 'Virtual Assistant', emoji: '🗂️' },
];

export const CITIES = [
  { slug: 'noida', name: 'Noida', region: 'Delhi NCR' },
  { slug: 'greater-noida', name: 'Greater Noida', region: 'Delhi NCR' },
  { slug: 'delhi', name: 'Delhi', region: 'Delhi NCR' },
  { slug: 'gurugram', name: 'Gurugram', region: 'Delhi NCR' },
  { slug: 'ghaziabad', name: 'Ghaziabad', region: 'Delhi NCR' },
  { slug: 'faridabad', name: 'Faridabad', region: 'Delhi NCR' },
  { slug: 'mumbai', name: 'Mumbai', region: 'West' },
  { slug: 'pune', name: 'Pune', region: 'West' },
  { slug: 'ahmedabad', name: 'Ahmedabad', region: 'West' },
  { slug: 'jaipur', name: 'Jaipur', region: 'North' },
  { slug: 'lucknow', name: 'Lucknow', region: 'North' },
  { slug: 'chandigarh', name: 'Chandigarh', region: 'North' },
  { slug: 'indore', name: 'Indore', region: 'Central' },
  { slug: 'bengaluru', name: 'Bengaluru', region: 'South' },
  { slug: 'hyderabad', name: 'Hyderabad', region: 'South' },
  { slug: 'chennai', name: 'Chennai', region: 'South' },
  { slug: 'kolkata', name: 'Kolkata', region: 'East' },
];

/** Rate units — labels come from the dictionary, not from here. */
export const RATE_UNITS = ['hour', 'day', 'project'];
export const RATE_UNIT_KEY = { hour: 'common.perHour', day: 'common.perDay', project: 'common.perProject' };

export const MS_PLANS = [
  { value: 1, labelKey: 'hire.planOnce', split: [100] },
  { value: 2, labelKey: 'hire.plan2', split: [50, 50] },
  { value: 3, labelKey: 'hire.plan3', split: [30, 40, 30] },
];

export const catBySlug = (s) => CATEGORIES.find((c) => c.slug === s);
export const cityBySlug = (s) => CITIES.find((c) => c.slug === s);
export const catName = (s) => catBySlug(s)?.name || 'Freelancer';
export const cityName = (s) => cityBySlug(s)?.name || '';
export const regionOf = (s) => cityBySlug(s)?.region || '';

/** Order + milestone statuses map to dictionary keys so they translate. */
export const ORDER_STATUS = {
  awaiting_acceptance: { key: 'order.statusAwaitingAcceptance', color: 'warning' },
  awaiting_payment: { key: 'order.statusAwaitingPayment', color: 'warning' },
  active: { key: 'order.statusActive', color: 'info' },
  completed: { key: 'order.statusCompleted', color: 'success' },
  cancelled: { key: 'order.statusCancelled', color: 'default' },
  disputed: { key: 'order.statusDisputed', color: 'error' },
  refunded: { key: 'order.statusRefunded', color: 'default' },
};

export const MS_STATUS = {
  pending: { key: 'order.msPending', color: 'default' },
  funded: { key: 'order.msFunded', color: 'info' },
  submitted: { key: 'order.msSubmitted', color: 'secondary' },
  changes_requested: { key: 'order.msChanges', color: 'warning' },
  released: { key: 'order.msReleased', color: 'success' },
  refunded: { key: 'order.msRefunded', color: 'default' },
};

export const OFFER_STATUS = {
  pending: { key: 'offer.statusPending', color: 'warning' },
  accepted: { key: 'offer.statusAccepted', color: 'success' },
  declined: { key: 'offer.statusDeclined', color: 'default' },
  countered: { key: 'offer.statusCountered', color: 'default' },
  withdrawn: { key: 'offer.statusWithdrawn', color: 'default' },
  used: { key: 'offer.statusUsed', color: 'secondary' },
};

export const MEET_STATUS = {
  proposed: { key: 'meeting.statusProposed', color: 'warning' },
  confirmed: { key: 'meeting.statusConfirmed', color: 'success' },
  declined: { key: 'meeting.statusDeclined', color: 'default' },
  cancelled: { key: 'meeting.statusCancelled', color: 'default' },
};

export const KYC_STATUS = {
  none: { key: 'kyc.statusNone', color: 'default' },
  pending: { key: 'kyc.statusPending', color: 'warning' },
  verified: { key: 'kyc.statusVerified', color: 'success' },
  rejected: { key: 'kyc.statusRejected', color: 'error' },
};

export const MAX_UPLOAD_MB = 25;
export const localPath = (category, city) => `/hire/${category}/${city}`;
