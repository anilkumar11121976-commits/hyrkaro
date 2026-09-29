import { z } from 'zod';
import mongoose from 'mongoose';
import FreelancerProfile from '../models/FreelancerProfile.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { CATEGORY_SLUGS, CITY_REGION, CITY_SLUGS, RATE_UNITS, citiesInRegion } from '../config/constants.js';
import { deleteAsset, isCloudinaryConfigured, uploadBuffer } from '../config/cloudinary.js';
import { commissionFor } from '../services/settings.js';
import { escapeRegex, isId, paginate } from '../utils/helpers.js';
import { AppError, badRequest, notFound } from '../utils/AppError.js';

const USER_PUBLIC = 'name avatar city lastSeenAt createdAt';

export const searchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  city: z.enum(CITY_SLUGS).optional(),
  category: z.enum(CATEGORY_SLUGS).optional(),
  minRate: z.coerce.number().min(0).optional(),
  maxRate: z.coerce.number().min(0).optional(),
  unit: z.enum(RATE_UNITS).optional(),
  remoteOnly: z.coerce.boolean().optional(),
  sort: z.enum(['relevance', 'rating', 'price_low', 'price_high', 'new', 'delivery']).optional().default('rating'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const statsSchema = z.object({
  city: z.enum(CITY_SLUGS).optional(),
  category: z.enum(CATEGORY_SLUGS).optional(),
});

export const updateProfileSchema = z.object({
  title: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORY_SLUGS).optional(),
  city: z.enum(CITY_SLUGS).optional(),
  area: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  languages: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  rate: z
    .object({ amount: z.coerce.number().min(0).max(10000000), unit: z.enum(RATE_UNITS) })
    .optional(),
  remoteOk: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

function buildFilter(q) {
  const filter = { 'verification.status': 'verified', isVisible: true };
  if (q.category) filter.category = q.category;
  if (q.unit) filter['rate.unit'] = q.unit;
  if (q.remoteOnly) filter.remoteOk = true;
  if (q.minRate != null || q.maxRate != null) {
    filter['rate.amount'] = {};
    if (q.minRate != null) filter['rate.amount'].$gte = q.minRate;
    if (q.maxRate != null) filter['rate.amount'].$lte = q.maxRate;
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ title: rx }, { skills: rx }, { bio: rx }];
  }
  return filter;
}

const SORTS = {
  relevance: { ratingAvg: -1, completedOrders: -1 },
  rating: { ratingAvg: -1, ratingCount: -1, completedOrders: -1 },
  price_low: { 'rate.amount': 1 },
  price_high: { 'rate.amount': -1 },
  new: { createdAt: -1 },
  delivery: { responseTimeHrs: 1, ratingAvg: -1 },
};

/**
 * PDF §3: city-first ranking. Results come back in three groups —
 * 1) the searcher's own city, 2) the rest of that region, 3) remote from
 * anywhere else — and the chosen sort applies *inside* each group, never
 * across them.
 */
export async function searchFreelancers(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q);
  const filter = buildFilter(q);

  if (!q.city) {
    const [items, total] = await Promise.all([
      FreelancerProfile.find(filter).sort(SORTS[q.sort] || SORTS.rating).skip(skip).limit(limit).populate('user', USER_PUBLIC),
      FreelancerProfile.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      items: items.map((i) => ({ ...i.toJSON(), tier: 'all' })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      cityFirst: false,
    });
  }

  const region = CITY_REGION[q.city];
  const regionCities = citiesInRegion(region).filter((c) => c !== q.city);
  const sort = SORTS[q.sort] || SORTS.rating;

  const pipeline = [
    { $match: filter },
    {
      $addFields: {
        // 0 = same city, 1 = same region, 2 = rest of India (remote only)
        tierRank: {
          $switch: {
            branches: [
              { case: { $eq: ['$city', q.city] }, then: 0 },
              { case: { $in: ['$city', regionCities] }, then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    // Outside the region, only freelancers who actually take remote work show up.
    { $match: { $or: [{ tierRank: { $lt: 2 } }, { tierRank: 2, remoteOk: true }] } },
    { $sort: { tierRank: 1, ...sort } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
          { $unwind: '$user' },
          {
            $project: {
              'user.password': 0,
              'user.email': 0,
              'user.phone': 0,
              'user.kyc': 0,
              'user.roles': 0,
              'user.isBlocked': 0,
              'user.acceptedPolicyAt': 0,
            },
          },
        ],
        total: [{ $count: 'n' }],
        tiers: [{ $group: { _id: '$tierRank', n: { $sum: 1 } } }],
      },
    },
  ];

  const [agg] = await FreelancerProfile.aggregate(pipeline);
  const total = agg?.total?.[0]?.n || 0;
  const tierNames = ['city', 'region', 'india'];
  const items = (agg?.items || []).map((p) => ({
    ...p,
    tier: tierNames[p.tierRank] ?? 'india',
    // Virtuals do not survive an aggregation, so recompute the ones the UI uses.
    isPro: p.plan?.type === 'pro' && p.plan?.proUntil && new Date(p.plan.proUntil) > new Date(),
  }));
  const counts = Object.fromEntries((agg?.tiers || []).map((t) => [tierNames[t._id] || 'india', t.n]));

  res.json({
    success: true,
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    cityFirst: true,
    city: q.city,
    region,
    tierCounts: { city: counts.city || 0, region: counts.region || 0, india: counts.india || 0 },
  });
}

export async function freelancerStats(req, res) {
  const { city, category } = req.valid.query;
  const match = { 'verification.status': 'verified', isVisible: true };
  if (city) match.city = city;
  if (category) match.category = category;
  const [agg] = await FreelancerProfile.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        minRate: { $min: '$rate.amount' },
        maxRate: { $max: '$rate.amount' },
        avgRate: { $avg: '$rate.amount' },
        avgRating: { $avg: '$ratingAvg' },
      },
    },
  ]);
  const byCategory = await FreelancerProfile.aggregate([
    { $match: city ? { ...match, category: { $ne: '' } } : { 'verification.status': 'verified', isVisible: true } },
    { $group: { _id: '$category', count: { $sum: 1 }, minRate: { $min: '$rate.amount' }, avgRate: { $avg: '$rate.amount' } } },
    { $sort: { count: -1 } },
  ]);
  res.json({
    success: true,
    stats: agg ? { ...agg, _id: undefined } : { count: 0, minRate: 0, maxRate: 0, avgRate: 0, avgRating: 0 },
    byCategory,
  });
}

export async function getFreelancer(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('Freelancer nahi mila');
  let profile = await FreelancerProfile.findById(id).populate('user', USER_PUBLIC);
  if (!profile) profile = await FreelancerProfile.findOne({ user: id }).populate('user', USER_PUBLIC);
  if (!profile || !profile.user) throw notFound('Freelancer nahi mila');

  const isOwner = req.user && String(req.user._id) === String(profile.user._id);
  const isAdmin = req.user?.role === 'admin';
  if (profile.verification.status !== 'verified' && !isOwner && !isAdmin) throw notFound('Freelancer nahi mila');

  // PDF §14: reviews an admin hid never show.
  const reviews = await Review.find({ freelancer: profile.user._id, hidden: false })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('client', 'name avatar companyName')
    .lean();

  const out = profile.toJSON();
  out.commissionPercent = await commissionFor({ category: profile.category, isPro: profile.isPro });
  res.json({ success: true, profile: out, reviews });
}

export async function getMyProfile(req, res) {
  let profile = await FreelancerProfile.findOne({ user: req.user._id });
  // Report H6: a profile created here gets no phantom Pro badge — the trial is
  // granted only by the signup path, which marks plan.trialUsed.
  if (!profile) profile = await FreelancerProfile.create({ user: req.user._id, city: req.user.city || '' });
  const out = profile.toJSON();
  out.commissionPercent = await commissionFor({ category: profile.category, isPro: profile.isPro });
  res.json({ success: true, profile: out });
}

export async function updateMyProfile(req, res) {
  const data = { ...req.valid.body };
  if (data.skills) data.skills = [...new Set(data.skills.map((s) => s.trim()))];
  // Keep the denormalised region in step so city-first ranking stays correct.
  if (data.city) data.region = CITY_REGION[data.city] || '';

  const profile = await FreelancerProfile.findOneAndUpdate({ user: req.user._id }, data, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });
  if (data.city) await User.updateOne({ _id: req.user._id }, { city: data.city });
  const out = profile.toJSON();
  out.commissionPercent = await commissionFor({ category: profile.category, isPro: profile.isPro });
  res.json({ success: true, profile: out });
}

export async function submitVerification(req, res) {
  const profile = await FreelancerProfile.findOne({ user: req.user._id });
  if (!profile) throw notFound('Profile nahi mili');
  if (profile.verification.status === 'verified') throw badRequest('Profile pehle se verified hai');
  if (profile.verification.status === 'pending') throw badRequest('Verification pehle se chal raha hai');
  const missing = [];
  if (!profile.title) missing.push('title');
  if (!profile.category) missing.push('category');
  if (!profile.city) missing.push('city');
  if (!profile.bio || profile.bio.length < 40) missing.push('bio (40+ characters)');
  if ((profile.skills || []).length < 2) missing.push('kam se kam 2 skills');
  if (!(profile.rate?.amount > 0)) missing.push('apne charges');
  if (missing.length) throw badRequest(`Pehle ye bharo: ${missing.join(', ')}`);
  profile.verification.status = 'pending';
  profile.verification.submittedAt = new Date();
  profile.verification.note = undefined;
  await profile.save();
  res.json({ success: true, profile, message: 'Verification ke liye bhej diya. 24-48 ghante mein review hoga.' });
}

export async function addPortfolio(req, res) {
  const files = req.files || [];
  if (!files.length) throw badRequest('Kam se kam ek file select karo');
  if (!isCloudinaryConfigured()) throw new AppError('File upload abhi setup nahi hai (Cloudinary keys daalo)', 503);
  const profile = await FreelancerProfile.findOne({ user: req.user._id });
  if (!profile) throw notFound('Profile nahi mili');
  if (profile.portfolio.length + files.length > 12) throw badRequest('Portfolio mein maximum 12 items rakh sakte ho');

  const titles = [].concat(req.body?.titles || []);
  const uploaded = await Promise.all(
    files.map((f) =>
      uploadBuffer(f.buffer, {
        folder: `portfolio/${req.user._id}`,
        resourceType: f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('video/') ? 'video' : 'raw',
        filename: f.originalname,
      }),
    ),
  );
  uploaded.forEach((r, i) =>
    profile.portfolio.push({
      url: r.secure_url,
      publicId: r.public_id,
      resourceType: r.resource_type,
      title: String(titles[i] || files[i].originalname).slice(0, 100),
      mime: files[i].mimetype,
    }),
  );
  await profile.save();
  res.status(201).json({ success: true, profile });
}

export async function removePortfolio(req, res) {
  const { itemId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw badRequest('Galat item');
  const profile = await FreelancerProfile.findOne({ user: req.user._id });
  const item = profile?.portfolio.id(itemId);
  if (!item) throw notFound('Item nahi mila');
  const { publicId, resourceType } = item;
  item.deleteOne();
  await profile.save();
  deleteAsset(publicId, resourceType);
  res.json({ success: true, profile });
}
