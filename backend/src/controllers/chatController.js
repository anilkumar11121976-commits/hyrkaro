import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import User from '../models/User.js';
import { isCloudinaryConfigured, uploadBuffer } from '../config/cloudinary.js';
import { BLOCKED_EXT, MAX_UPLOAD_MB } from '../config/constants.js';
import { emitToUsers } from '../sockets/index.js';
import { notify } from '../services/notify.js';
import { isId, maskContactInfo } from '../utils/helpers.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/AppError.js';

const USER_PUBLIC = 'name avatar role city companyName lastSeenAt';

export const startSchema = z.object({
  freelancerId: z.string().min(1),
  requirementId: z.string().optional(),
});
export const messageSchema = z.object({ text: z.string().trim().min(1, 'Message khali hai').max(4000) });
export const listMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});
export const offerSchema = z.object({
  amount: z.coerce.number().int('Amount poore rupees mein likho').min(100, 'Kam se kam ₹100').max(10000000),
  deliveryDays: z.coerce.number().int().min(1).max(365),
  description: z.string().trim().max(1000).optional().default(''),
});
export const offerRespondSchema = z.object({ action: z.enum(['accept', 'decline', 'withdraw']) });
export const meetingSchema = z.object({
  when: z.coerce.date().refine((d) => d.getTime() > Date.now() - 5 * 60 * 1000, 'Aane wala time chuno'),
  mins: z.coerce.number().int().min(10).max(120).default(30),
  topic: z.string().trim().max(200).optional().default('Project discussion'),
});
export const meetingRespondSchema = z.object({ action: z.enum(['confirm', 'decline', 'cancel']) });

/* ---------------- helpers ---------------- */

export async function loadConversation(id, userId) {
  if (!isId(id)) throw notFound('Chat nahi mili');
  const conv = await Conversation.findById(id);
  if (!conv) throw notFound('Chat nahi mili');
  if (!conv.hasMember(userId)) throw forbidden('Ye chat aapki nahi hai');
  return conv;
}

function previewText(msg) {
  switch (msg.type) {
    case 'offer':
      return `Offer: ₹${msg.offer.amount.toLocaleString('en-IN')}`;
    case 'meeting':
      return 'Video meeting request';
    case 'file':
      return `File: ${msg.file?.name || 'attachment'}`;
    default:
      return msg.text?.slice(0, 120) || '';
  }
}

export async function createMessage(conv, senderId, data) {
  const msg = await Message.create({ conversation: conv._id, sender: senderId, ...data });
  const fromClient = String(conv.client) === String(senderId);

  /**
   * Report M3: increment atomically. Two messages arriving at once no longer
   * lose one of the unread counts.
   */
  const inc = msg.type === 'system' ? {} : fromClient ? { unreadFreelancer: 1 } : { unreadClient: 1 };
  const updated = await Conversation.findByIdAndUpdate(
    conv._id,
    {
      $set: { lastMessage: { text: previewText(msg), type: msg.type, sender: senderId, at: msg.createdAt } },
      ...(Object.keys(inc).length ? { $inc: inc } : {}),
    },
    { new: true },
  );
  // Keep the in-memory doc in step with what the database now holds.
  if (updated) {
    conv.lastMessage = updated.lastMessage;
    conv.unreadClient = updated.unreadClient;
    conv.unreadFreelancer = updated.unreadFreelancer;
  }

  const payload = { conversationId: String(conv._id), message: msg.toJSON() };
  emitToUsers([conv.client, conv.freelancer], 'message:new', payload);
  return msg;
}

function emitMessageUpdate(conv, msg) {
  emitToUsers([conv.client, conv.freelancer], 'message:update', {
    conversationId: String(conv._id),
    message: msg.toJSON(),
  });
}

/**
 * PDF §5: repeated attempts to pass contact details out of the platform earn a
 * strike; enough strikes and the admin sees the account flagged.
 */
async function recordContactStrike(userId, kinds) {
  if (!kinds?.length) return null;
  const user = await User.findByIdAndUpdate(userId, { $inc: { contactStrikes: 1 } }, { new: true }).select(
    'contactStrikes name',
  );
  if (user && user.contactStrikes === 3) {
    await notify(userId, {
      type: 'admin_warning',
      title: 'Warning: contact details share mat karo',
      body: 'Sirf HyrKro ki chat aur payment valid hai. Baar-baar number/UPI share karne pe account suspend ho sakta hai.',
      link: '/inbox',
    });
  }
  return user;
}

/* ---------------- conversations ---------------- */

export async function startConversation(req, res) {
  if (req.user.role !== 'client') throw forbidden('Chat shuru karne ke liye client account se login karo');
  const { freelancerId } = req.valid.body;
  if (!isId(freelancerId)) throw badRequest('Galat freelancer');

  let profile = await FreelancerProfile.findById(freelancerId);
  if (!profile) profile = await FreelancerProfile.findOne({ user: freelancerId });
  if (!profile || profile.verification.status !== 'verified') throw notFound('Freelancer nahi mila');
  const freelancerUser = await User.findById(profile.user);
  if (!freelancerUser || freelancerUser.isBlocked) throw notFound('Freelancer nahi mila');
  if (String(freelancerUser._id) === String(req.user._id)) throw badRequest('Apne aap se chat nahi kar sakte');

  /**
   * Report M5: upsert instead of find-then-create, so a double click returns the
   * existing chat rather than a duplicate-key error.
   */
  const conv = await Conversation.findOneAndUpdate(
    { client: req.user._id, freelancer: freelancerUser._id },
    { $setOnInsert: { client: req.user._id, freelancer: freelancerUser._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const created = !conv.lastMessage?.at;
  if (created) {
    await createMessage(conv, req.user._id, {
      type: 'system',
      text: 'Chat shuru hui. Sirf HyrKro ki chat aur payment valid hai; bahar ki deal ke liye HyrKro zimmedar nahi.',
    });
  }
  res.status(created ? 201 : 200).json({ success: true, conversation: conv, created });
}

export async function listConversations(req, res) {
  const uid = req.user._id;
  const convs = await Conversation.find({ $or: [{ client: uid }, { freelancer: uid }] })
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate('client', USER_PUBLIC)
    .populate('freelancer', USER_PUBLIC)
    .lean();
  const items = convs
    .filter((c) => c.client && c.freelancer)
    .map((c) => {
      const isClient = String(c.client._id) === String(uid);
      return {
        _id: c._id,
        other: isClient ? c.freelancer : c.client,
        lastMessage: c.lastMessage,
        unread: isClient ? c.unreadClient : c.unreadFreelancer,
        updatedAt: c.updatedAt,
      };
    });
  res.json({ success: true, items, totalUnread: items.reduce((s, i) => s + (i.unread || 0), 0) });
}

export async function getConversation(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  await conv.populate([
    { path: 'client', select: USER_PUBLIC },
    { path: 'freelancer', select: USER_PUBLIC },
  ]);
  const profile = await FreelancerProfile.findOne({ user: conv.freelancer._id }).select(
    'title category city rate ratingAvg ratingCount verification.status plan',
  );
  res.json({ success: true, conversation: conv, freelancerProfile: profile });
}

export async function listMessages(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  const { before, limit } = req.valid.query;
  const filter = { conversation: conv._id };
  if (before) filter.createdAt = { $lt: new Date(before) };
  const items = await Message.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ success: true, items: items.reverse(), hasMore: items.length === limit });
}

export async function markRead(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  const isClient = String(conv.client) === String(req.user._id);
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: isClient ? { unreadClient: 0 } : { unreadFreelancer: 0 } },
  );
  await Message.updateMany(
    { conversation: conv._id, sender: { $ne: req.user._id }, readAt: null },
    { readAt: new Date() },
  );
  /**
   * Report M7: tell both sides. The other member updates their read ticks, and
   * the reader's own conversation list clears its badge without a refetch race.
   */
  emitToUsers([conv.client, conv.freelancer], 'conversation:read', {
    conversationId: String(conv._id),
    by: String(req.user._id),
  });
  res.json({ success: true });
}

/* ---------------- messages ---------------- */

export async function sendMessage(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  const { text, flagged, kinds } = maskContactInfo(req.valid.body.text);
  const msg = await createMessage(conv, req.user._id, { type: 'text', text, flagged, flagKinds: kinds });
  if (flagged) await recordContactStrike(req.user._id, kinds);

  const other = conv.otherMember(req.user._id);
  await notify(other, {
    type: 'message',
    title: `${req.user.name.split(' ')[0]} ne message bheja`,
    body: text.slice(0, 120),
    link: `/inbox/${conv._id}`,
  });

  res.status(201).json({
    success: true,
    message: msg,
    ...(flagged
      ? { warning: 'Number/email/UPI chhupa diya gaya. Sirf HyrKro ki chat aur payment valid hai.' }
      : {}),
  });
}

export async function sendFile(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  if (!req.file) throw badRequest('File select karo');
  if (!isCloudinaryConfigured()) throw new AppError('File upload abhi setup nahi hai (Cloudinary keys daalo)', 503);
  const f = req.file;

  // PDF §5: executables are blocked by extension as well as by MIME type.
  const ext = path.extname(f.originalname || '').toLowerCase();
  if (BLOCKED_EXT.includes(ext)) throw badRequest(`${ext} file allowed nahi hai`);
  if (f.size > MAX_UPLOAD_MB * 1024 * 1024) throw badRequest(`File ${MAX_UPLOAD_MB} MB se chhoti honi chahiye`);

  const resourceType = f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('video/') ? 'video' : 'raw';
  const r = await uploadBuffer(f.buffer, { folder: `chat/${conv._id}`, resourceType, filename: f.originalname });
  const caption = req.body?.text ? maskContactInfo(String(req.body.text).slice(0, 1000)).text : '';
  const msg = await createMessage(conv, req.user._id, {
    type: 'file',
    text: caption,
    file: {
      url: r.secure_url,
      publicId: r.public_id,
      name: f.originalname,
      size: f.size,
      mime: f.mimetype,
      resourceType: r.resource_type,
    },
  });
  await notify(conv.otherMember(req.user._id), {
    type: 'message',
    title: `${req.user.name.split(' ')[0]} ne file bheji`,
    body: f.originalname,
    link: `/inbox/${conv._id}`,
  });
  res.status(201).json({ success: true, message: msg });
}

/* ---------------- offers (negotiation, PDF §6) ---------------- */

export async function sendOffer(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  const { amount, deliveryDays, description } = req.valid.body;
  const masked = maskContactInfo(description);

  // Any open offer in this chat becomes "countered" when a new one is made.
  const open = await Message.find({ conversation: conv._id, type: 'offer', 'offer.status': 'pending' });
  for (const m of open) {
    m.offer.status = String(m.sender) === String(req.user._id) ? 'withdrawn' : 'countered';
    m.offer.respondedAt = new Date();
    await m.save();
    emitMessageUpdate(conv, m);
  }
  const msg = await createMessage(conv, req.user._id, {
    type: 'offer',
    text: masked.text,
    flagged: masked.flagged,
    flagKinds: masked.kinds,
    offer: { amount, deliveryDays, description: masked.text, status: 'pending' },
  });
  await notify(conv.otherMember(req.user._id), {
    type: 'offer_received',
    title: `Naya offer: ₹${amount.toLocaleString('en-IN')}`,
    body: `${deliveryDays} din delivery`,
    link: `/inbox/${conv._id}`,
  });
  res.status(201).json({ success: true, message: msg });
}

export async function respondOffer(req, res) {
  const { messageId } = req.params;
  if (!isId(messageId)) throw notFound('Offer nahi mila');
  const { action } = req.valid.body;
  const status = { accept: 'accepted', decline: 'declined', withdraw: 'withdrawn' }[action];

  // Claim the offer atomically so two taps cannot both act on it.
  const existing = await Message.findById(messageId);
  if (!existing || existing.type !== 'offer') throw notFound('Offer nahi mila');
  const conv = await loadConversation(existing.conversation, req.user._id);
  const isSender = String(existing.sender) === String(req.user._id);

  if (action === 'withdraw' && !isSender) throw forbidden('Sirf bhejne wala offer wapas le sakta hai');
  if (action !== 'withdraw' && isSender) throw forbidden('Apne offer ko aap accept/decline nahi kar sakte');

  const msg = await Message.findOneAndUpdate(
    { _id: messageId, 'offer.status': 'pending' },
    { $set: { 'offer.status': status, 'offer.respondedAt': new Date() } },
    { new: true },
  );
  if (!msg) throw badRequest('Is offer pe pehle hi faisla ho chuka hai');
  emitMessageUpdate(conv, msg);

  const actor = req.user.name.split(' ')[0];
  const note = {
    accept: `${actor} ne ₹${msg.offer.amount.toLocaleString('en-IN')} ka offer accept kiya. Client ab "Hire karo" daba sakta hai.`,
    decline: `${actor} ne offer decline kiya.`,
    withdraw: `${actor} ne offer wapas le liya.`,
  }[action];
  await createMessage(conv, req.user._id, { type: 'system', text: note });
  if (action !== 'withdraw') {
    await notify(msg.sender, {
      type: action === 'accept' ? 'offer_accepted' : 'offer_declined',
      title: action === 'accept' ? 'Offer accept ho gaya' : 'Offer decline hua',
      body: `₹${msg.offer.amount.toLocaleString('en-IN')}`,
      link: `/inbox/${conv._id}`,
    });
  }
  res.json({ success: true, message: msg });
}

/* ---------------- meetings (PDF §5) ---------------- */

export async function proposeMeeting(req, res) {
  const conv = await loadConversation(req.params.id, req.user._id);
  const { when, mins, topic } = req.valid.body;
  const room = `HyrKro-${crypto.randomBytes(6).toString('hex')}`;
  const msg = await createMessage(conv, req.user._id, {
    type: 'meeting',
    text: topic,
    meeting: {
      when,
      mins,
      topic: maskContactInfo(topic).text,
      status: 'proposed',
      link: `https://meet.jit.si/${room}`,
    },
  });
  await notify(conv.otherMember(req.user._id), {
    type: 'meeting_proposed',
    title: 'Video meeting request',
    body: topic,
    link: `/inbox/${conv._id}`,
  });
  res.status(201).json({ success: true, message: msg });
}

export async function respondMeeting(req, res) {
  const { messageId } = req.params;
  if (!isId(messageId)) throw notFound('Meeting nahi mili');
  const msg = await Message.findById(messageId);
  if (!msg || msg.type !== 'meeting') throw notFound('Meeting nahi mili');
  const conv = await loadConversation(msg.conversation, req.user._id);
  const { action } = req.valid.body;
  const isSender = String(msg.sender) === String(req.user._id);
  if (action === 'cancel') {
    if (!isSender) throw forbidden('Sirf bhejne wala cancel kar sakta hai');
    if (!['proposed', 'confirmed'].includes(msg.meeting.status)) throw badRequest('Meeting pehle hi band hai');
  } else {
    if (isSender) throw forbidden('Doosre member ko confirm karna hai');
    if (msg.meeting.status !== 'proposed') throw badRequest('Is meeting pe faisla ho chuka hai');
  }
  msg.meeting.status = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[action];
  await msg.save();
  emitMessageUpdate(conv, msg);
  if (action === 'confirm') {
    await notify(msg.sender, {
      type: 'meeting_confirmed',
      title: 'Meeting confirm ho gayi',
      body: msg.meeting.topic || '',
      link: `/inbox/${conv._id}`,
    });
  }
  res.json({ success: true, message: msg });
}
