import { z } from 'zod';
import Requirement from '../models/Requirement.js';
import Interest from '../models/Interest.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import Conversation from '../models/Conversation.js';
import { CATEGORY_SLUGS, CITY_SLUGS, INTEREST_DAILY_LIMIT } from '../config/constants.js';
import { notify } from '../services/notify.js';
import { addDays, dayKey, isId, maskContactInfo, paginate } from '../utils/helpers.js';
import { badRequest, conflict, forbidden, notFound, AppError } from '../utils/AppError.js';
import { createMessage } from './chatController.js';

/* PDF §11: client posts a requirement, freelancers send one interest each. */

export const createRequirementSchema = z
  .object({
    title: z.string().trim().min(5, 'Kaam ka title likho').max(140),
    description: z.string().trim().min(20, 'Kaam thoda detail mein likho').max(3000),
    category: z.enum(CATEGORY_SLUGS, { errorMap: () => ({ message: 'Category chuno' }) }),
    city: z.enum([...CITY_SLUGS, '']).optional().default(''),
    remoteOk: z.boolean().optional().default(true),
    budgetMin: z.coerce.number().int().min(0).max(10000000).optional().default(0),
    budgetMax: z.coerce.number().int().min(0).max(10000000).optional().default(0),
    deadline: z.coerce.date().optional(),
  })
  .refine((d) => !d.budgetMax || !d.budgetMin || d.budgetMax >= d.budgetMin, {
    message: 'Max budget, min se zyada hona chahiye',
    path: ['budgetMax'],
  });

export const listRequirementsSchema = z.object({
  category: z.enum(CATEGORY_SLUGS).optional(),
  city: z.enum(CITY_SLUGS).optional(),
  status: z.enum(['open', 'closed', 'hired', 'expired']).optional(),
  mine: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const interestSchema = z.object({
  message: z.string().trim().max(1000).optional().default(''),
  quote: z.coerce.number().int().min(100).max(10000000).optional(),
  deliveryDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const closeSchema = z.object({ status: z.enum(['closed', 'open']) });

const CLIENT_PUBLIC = 'name avatar city companyName';
const FREELANCER_PUBLIC = 'name avatar city';

export async function createRequirement(req, res) {
  if (req.user.role !== 'client') throw forbidden('Requirement sirf client post kar sakta hai');
  const data = req.valid.body;
  // Contact details do not belong in a public post either.
  const title = maskContactInfo(data.title).text;
  const description = maskContactInfo(data.description).text;

  const open = await Requirement.countDocuments({ client: req.user._id, status: 'open' });
  if (open >= 10) throw badRequest('Ek saath 10 se zyada requirement open nahi rakh sakte');

  const requirement = await Requirement.create({
    ...data,
    title,
    description,
    client: req.user._id,
    city: data.city || req.user.city || '',
    expiresAt: addDays(new Date(), 30),
  });
  res.status(201).json({ success: true, requirement });
}

export async function listRequirements(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q, { defLimit: 20 });
  const filter = {};

  if (q.mine) {
    filter.client = req.user._id;
    if (q.status) filter.status = q.status;
  } else {
    // The public board only ever shows open posts.
    filter.status = 'open';
    if (q.category) filter.category = q.category;
    if (q.city) filter.city = q.city;
  }

  const [items, total] = await Promise.all([
    Requirement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client', CLIENT_PUBLIC)
      .lean(),
    Requirement.countDocuments(filter),
  ]);

  // Tell a freelancer which posts they already responded to.
  let sentIds = [];
  if (req.user?.role === 'freelancer' && items.length) {
    const sent = await Interest.find({
      freelancer: req.user._id,
      requirement: { $in: items.map((i) => i._id) },
    }).select('requirement').lean();
    sentIds = sent.map((s) => String(s.requirement));
  }
  res.json({
    success: true,
    items: items.map((i) => ({ ...i, alreadySent: sentIds.includes(String(i._id)) })),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
}

export async function getRequirement(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('Requirement nahi mili');
  const requirement = await Requirement.findById(id).populate('client', CLIENT_PUBLIC).lean();
  if (!requirement) throw notFound('Requirement nahi mili');

  const isOwner = String(requirement.client?._id) === String(req.user?._id);
  if (requirement.status !== 'open' && !isOwner && req.user?.role !== 'admin') {
    throw notFound('Requirement nahi mili');
  }

  // Only the client who posted it sees who responded.
  let interests = null;
  let mine = null;
  if (isOwner) {
    interests = await Interest.find({ requirement: id })
      .sort({ createdAt: -1 })
      .populate('freelancer', FREELANCER_PUBLIC)
      .lean();
    const profiles = await FreelancerProfile.find({ user: { $in: interests.map((i) => i.freelancer?._id) } })
      .select('user title category city rate ratingAvg ratingCount completedOrders verification.status')
      .lean();
    const byUser = Object.fromEntries(profiles.map((p) => [String(p.user), p]));
    interests = interests.map((i) => ({ ...i, profile: byUser[String(i.freelancer?._id)] || null }));
  } else if (req.user?.role === 'freelancer') {
    mine = await Interest.findOne({ requirement: id, freelancer: req.user._id }).lean();
  }
  res.json({ success: true, requirement, interests, mine });
}

/** PDF §11: one interest per requirement, with a daily cap to stop spam. */
export async function sendInterest(req, res) {
  if (req.user.role !== 'freelancer') throw forbidden('Sirf freelancer interest bhej sakta hai');
  const { id } = req.params;
  if (!isId(id)) throw notFound('Requirement nahi mili');

  const profile = await FreelancerProfile.findOne({ user: req.user._id });
  if (!profile || profile.verification.status !== 'verified') {
    throw forbidden('Pehle profile verify karwao, phir interest bhej sakte ho');
  }

  const requirement = await Requirement.findById(id);
  if (!requirement || requirement.status !== 'open') throw notFound('Ye requirement ab open nahi hai');
  if (String(requirement.client) === String(req.user._id)) throw badRequest('Apni hi requirement pe interest nahi bhej sakte');

  // Daily budget, reset by calendar day.
  const today = dayKey();
  if (profile.interestsDay !== today) {
    profile.interestsDay = today;
    profile.interestsSentToday = 0;
  }
  if (profile.interestsSentToday >= INTEREST_DAILY_LIMIT) {
    throw new AppError(`Aaj ke liye ${INTEREST_DAILY_LIMIT} interest ki limit poori ho gayi. Kal phir try karo.`, 429);
  }

  const { message, quote, deliveryDays } = req.valid.body;
  const masked = maskContactInfo(message);

  let interest;
  try {
    interest = await Interest.create({
      requirement: requirement._id,
      freelancer: req.user._id,
      client: requirement.client,
      message: masked.text,
      quote,
      deliveryDays,
    });
  } catch (e) {
    // The unique index is what actually enforces "ek hi baar".
    if (e.code === 11000) throw conflict('Is requirement pe aap pehle hi interest bhej chuke ho');
    throw e;
  }

  profile.interestsSentToday += 1;
  await profile.save();
  await Requirement.updateOne({ _id: requirement._id }, { $inc: { interestCount: 1 } });

  await notify(requirement.client, {
    type: 'interest_received',
    title: 'Naya interest aaya',
    body: `${req.user.name} – ${requirement.title}`,
    link: `/requirements/${requirement._id}`,
  });

  res.status(201).json({
    success: true,
    interest,
    remainingToday: Math.max(0, INTEREST_DAILY_LIMIT - profile.interestsSentToday),
    ...(masked.flagged ? { warning: 'Contact details chhupa diye. Chat HyrKro pe hi karo.' } : {}),
  });
}

/** Client opens a chat with one of the freelancers who responded. */
export async function chatWithInterest(req, res) {
  const { id, interestId } = req.params;
  if (!isId(id) || !isId(interestId)) throw notFound('Nahi mila');
  const requirement = await Requirement.findById(id);
  if (!requirement) throw notFound('Requirement nahi mili');
  if (String(requirement.client) !== String(req.user._id)) throw forbidden('Ye requirement aapki nahi hai');

  const interest = await Interest.findById(interestId);
  if (!interest || String(interest.requirement) !== String(id)) throw notFound('Interest nahi mila');

  const conv = await Conversation.findOneAndUpdate(
    { client: req.user._id, freelancer: interest.freelancer },
    { $setOnInsert: { client: req.user._id, freelancer: interest.freelancer } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (!conv.lastMessage?.at) {
    await createMessage(conv, req.user._id, {
      type: 'system',
      text: 'Chat shuru hui. Sirf HyrKro ki chat aur payment valid hai; bahar ki deal ke liye HyrKro zimmedar nahi.',
    });
  }
  await createMessage(conv, req.user._id, {
    type: 'system',
    text: `Requirement "${requirement.title}" pe baat ho rahi hai.`,
  });

  interest.conversation = conv._id;
  interest.status = 'shortlisted';
  await interest.save();

  res.json({ success: true, conversationId: conv._id });
}

export async function setRequirementStatus(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('Requirement nahi mili');
  const requirement = await Requirement.findById(id);
  if (!requirement) throw notFound('Requirement nahi mili');
  if (String(requirement.client) !== String(req.user._id) && req.user.role !== 'admin') throw forbidden();
  if (requirement.status === 'hired') throw badRequest('Hire ho chuki requirement band hi rehti hai');

  requirement.status = req.valid.body.status;
  requirement.closedAt = requirement.status === 'closed' ? new Date() : undefined;
  await requirement.save();

  if (requirement.status === 'closed') {
    const interests = await Interest.find({ requirement: id, status: 'sent' }).select('freelancer').lean();
    await Promise.all(
      interests.map((i) =>
        notify(i.freelancer, {
          type: 'requirement_closed',
          title: 'Requirement band ho gayi',
          body: requirement.title,
          link: '/requirements',
        }),
      ),
    );
  }
  res.json({ success: true, requirement });
}

export async function myInterests(req, res) {
  if (req.user.role !== 'freelancer') throw forbidden();
  const { page, limit, skip } = paginate(req.query, { defLimit: 20 });
  const [items, total] = await Promise.all([
    Interest.find({ freelancer: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('requirement', 'title category city status budgetMin budgetMax createdAt')
      .lean(),
    Interest.countDocuments({ freelancer: req.user._id }),
  ]);
  const profile = await FreelancerProfile.findOne({ user: req.user._id }).select('interestsSentToday interestsDay').lean();
  const usedToday = profile?.interestsDay === dayKey() ? profile.interestsSentToday : 0;
  res.json({
    success: true,
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    dailyLimit: INTEREST_DAILY_LIMIT,
    remainingToday: Math.max(0, INTEREST_DAILY_LIMIT - usedToday),
  });
}
