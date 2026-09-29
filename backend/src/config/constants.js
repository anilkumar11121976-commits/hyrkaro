// Keep in sync with frontend/src/lib/constants.js

export const CATEGORIES = [
  { slug: 'web-app-development', name: 'Web & App Development', role: 'Web Developer' },
  { slug: 'graphic-design', name: 'Graphic Design', role: 'Graphic Designer' },
  { slug: 'digital-marketing', name: 'Digital Marketing', role: 'Digital Marketer' },
  { slug: 'content-writing', name: 'Content Writing', role: 'Content Writer' },
  { slug: 'video-photography', name: 'Video & Photography', role: 'Video Editor' },
  { slug: 'influencers', name: 'Influencers', role: 'Influencer' },
  { slug: 'social-media', name: 'Social Media Management', role: 'Social Media Manager' },
  { slug: 'virtual-assistant', name: 'Virtual Assistant & Data Entry', role: 'Virtual Assistant' },
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

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
export const CITY_SLUGS = CITIES.map((c) => c.slug);

/** city slug -> region, used by the city-first ranking (PDF §3). */
export const CITY_REGION = Object.fromEntries(CITIES.map((c) => [c.slug, c.region]));
export const citiesInRegion = (region) => CITIES.filter((c) => c.region === region).map((c) => c.slug);

export const ROLES = ['client', 'freelancer', 'admin'];
export const RATE_UNITS = ['hour', 'day', 'project'];

/** UI languages (PDF-independent; switcher lives in the header). */
export const LANGS = ['hinglish', 'hi', 'en'];

// Milestone plans: number of milestones -> percentage split + names
export const MS_SPLIT = { 1: [100], 2: [50, 50], 3: [30, 40, 30] };
export const MS_NAMES = {
  1: ['Poora kaam'],
  2: ['Pehla hissa', 'Final delivery'],
  3: ['Shuruaat', 'Beech ka kaam', 'Final delivery'],
};

export const MAX_UPLOAD_MB = 25;
/** PDF §5: .exe and other executables are blocked outright. */
export const BLOCKED_EXT = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.jar',
  '.sh', '.bash', '.ps1', '.vbs', '.js', '.jse', '.wsf', '.wsh', '.apk', '.dmg', '.app',
];
export const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
];

/** PDF §5: chat files are deleted 6 months after the order completes. */
export const CHAT_FILE_TTL_DAYS = 183;
/** PDF §17: account deletion happens 30 days after the request. */
export const ACCOUNT_DELETE_DAYS = 30;
/** PDF §11: a freelancer may send one interest per requirement, this many per day. */
export const INTEREST_DAILY_LIMIT = 10;

export const REQUIREMENT_STATUS = ['open', 'closed', 'hired', 'expired'];
export const DISPUTE_STATUS = ['open', 'resolved_client', 'resolved_freelancer', 'resolved_split', 'withdrawn'];
export const KYC_STATUS = ['none', 'pending', 'verified', 'rejected'];
